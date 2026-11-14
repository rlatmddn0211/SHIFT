package com.shift.vehicle

import ai.pleos.playground.stt.SpeechToText
import ai.pleos.playground.stt.constant.ErrorType as SttError
import ai.pleos.playground.stt.constant.Mode as SttMode
import ai.pleos.playground.stt.listener.OnInitializeListener as SttInit
import ai.pleos.playground.stt.listener.ResultListener
import ai.pleos.playground.tts.TextToSpeech
import ai.pleos.playground.tts.constant.ErrorType as TtsError
import ai.pleos.playground.tts.constant.Mode as TtsMode
import ai.pleos.playground.tts.listener.EventListener
import ai.pleos.playground.tts.listener.OnInitializeListener as TtsInit
import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import java.util.Locale

internal class PleosSpeech(
    private val context: Context,
    private val main: Handler,
) {
    private var playback: Playback? = null
    private var recognition: Recognition? = null

    fun speak(text: String, callback: (PleosActionResult) -> Unit) {
        stop()
        if (text.isBlank()) {
            callback(PleosActionResult(false, "읽을 브리핑이 없어요."))
            return
        }
        runCatching {
            val request = Playback(text, callback)
            playback = request
            request.start()
        }.onFailure {
            stop()
            callback(PleosActionResult(false, "Pleos 음성 안내 서비스에 연결하지 못했어요."))
        }
    }

    fun listen(callback: (Result<String>) -> Unit) {
        stop()
        runCatching {
            val request = Recognition(callback)
            recognition = request
            request.start()
        }.onFailure {
            stop()
            callback(Result.failure(IllegalStateException("Pleos 음성 인식 서비스에 연결하지 못했어요.")))
        }
    }

    fun stop() {
        val currentPlayback = playback
        val currentRecognition = recognition
        playback = null
        recognition = null
        currentPlayback?.close()
        currentRecognition?.close()
    }

    private inner class Playback(
        private val text: String,
        private val callback: (PleosActionResult) -> Unit,
    ) {
        private val tts = TextToSpeech(context, TtsMode.ON_DEVICE)
        private var requested = false
        private val timeout = Runnable { finish(false, "음성 안내가 제시간에 끝나지 않았어요.") }
        private val listener = object : EventListener {
            override fun onStart() = Unit
            override fun onReady() = Unit
            override fun onUpdatedRms(rms: Double) = Unit
            override fun onDone() {
                main.post { if (requested) finish(true, "음성 브리핑을 읽었어요.") }
            }
            override fun onStop() {
                main.post { finish(false, "음성 안내가 중단됐어요.") }
            }
            override fun onError(errorType: TtsError) {
                main.post { finish(false, "음성 안내에 실패했어요. (${errorType.name})") }
            }
        }

        fun start() {
            main.postDelayed(timeout, 45_000)
            tts.initialize(object : TtsInit {
                override fun onSuccess() {
                    main.post {
                        if (playback !== this@Playback || requested) return@post
                        runCatching {
                            tts.addEventListener(listener)
                            tts.setLocale(Locale.KOREA)
                            tts.setAudioAttributes(
                                AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .build(),
                            )
                            requested = true
                            tts.speak(text, isFinal = true)
                        }.onFailure { finish(false, "음성 안내를 시작하지 못했어요.") }
                    }
                }
                override fun onFailure(errorType: TtsError) {
                    main.post { finish(false, "음성 안내를 준비하지 못했어요. (${errorType.name})") }
                }
            })
        }

        private fun finish(success: Boolean, message: String) {
            if (playback !== this) return
            stop()
            callback(PleosActionResult(success, message))
        }

        fun close() {
            main.removeCallbacks(timeout)
            runCatching { tts.removeEventListener(listener) }
            if (requested) runCatching { tts.stop() }
            runCatching { tts.release() }
        }
    }

    private inner class Recognition(private val callback: (Result<String>) -> Unit) {
        private val stt = SpeechToText(context, SttMode.ON_DEVICE)
        private var requested = false
        private val timeout = Runnable { finish(null, "최종 인식 결과를 받지 못했어요. 다시 녹음해 주세요.") }
        private val ended = Runnable { finish(null, "인식된 음성이 없어요. 다시 녹음해 주세요.") }
        private val listener = object : ResultListener {
            override fun onReady() = Unit
            override fun onStartedRecognition() = Unit
            override fun onUpdatedEpdData(on: Long, off: Long) = Unit
            override fun onUpdatedRms(rms: Double) = Unit
            override fun onUpdated(stt: String, completed: Boolean) {
                if (completed) {
                    main.post {
                        finish(stt.trim().takeIf(String::isNotBlank), "인식된 음성이 없어요.")
                    }
                }
            }
            override fun onEndedRecognition() {
                main.post {
                    if (recognition === this@Recognition) {
                        main.removeCallbacks(ended)
                        main.postDelayed(ended, 1_000)
                    }
                }
            }
            override fun onError(errorType: SttError) {
                main.post { finish(null, "음성 인식에 실패했어요. (${errorType.name})") }
            }
        }

        fun start() {
            main.postDelayed(timeout, 30_000)
            stt.initialize(object : SttInit {
                override fun onSuccess() {
                    main.post {
                        if (recognition !== this@Recognition || requested) return@post
                        runCatching {
                            stt.addListener(listener)
                            stt.setLocale(Locale.KOREA)
                            requested = true
                            stt.request()
                        }.onFailure { finish(null, "음성 인식을 시작하지 못했어요.") }
                    }
                }
                override fun onFailure(errorType: SttError) {
                    main.post { finish(null, "음성 인식을 준비하지 못했어요. (${errorType.name})") }
                }
            })
        }

        private fun finish(text: String?, error: String) {
            if (recognition !== this) return
            stop()
            callback(if (text != null) Result.success(text) else Result.failure(IllegalStateException(error)))
        }

        fun close() {
            main.removeCallbacks(timeout)
            main.removeCallbacks(ended)
            runCatching { stt.removeListener(listener) }
            if (requested) runCatching { stt.stop() }
            runCatching { stt.release() }
        }
    }
}
