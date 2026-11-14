package com.shift.vehicle

import android.app.Activity
import android.app.Dialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.WindowManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.shift.vehicle.ShiftVehicleDesign.Companion.BACKGROUND
import com.shift.vehicle.ShiftVehicleDesign.Companion.LINE
import com.shift.vehicle.ShiftVehicleDesign.Companion.MUTED
import com.shift.vehicle.ShiftVehicleDesign.Companion.SKY
import com.shift.vehicle.ShiftVehicleDesign.Companion.TEXT
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.roundToInt

internal class VehicleWorkController(
    private val activity: Activity,
    private val platform: PleosPlatform,
    private val session: VehicleLoginApi.Session,
    private val workspaceApi: WorkspaceApi,
    private val canWork: () -> Boolean,
    private val notifyChanged: () -> Unit,
    private val onSessionEnded: () -> Unit,
    private val onNavigationPending: (PleosDestination?) -> Unit,
) {
    private data class Action(val title: String, val primary: Boolean = true, val run: () -> Unit)
    private data class NoteDraft(val text: String, val visit: Visit?, val requestId: String = UUID.randomUUID().toString())

    private val main = Handler(Looper.getMainLooper())
    private val notes = Executors.newSingleThreadExecutor()
    private var dialog: Dialog? = null
    private var revision = 0
    private var closed = false

    fun show(action: VehicleWorkAction, workspace: Workspace) {
        if (!allowed()) return
        clear()
        when (action) {
            is VehicleWorkAction.Destination -> destination(action.visit)
            VehicleWorkAction.Briefing -> briefing(workspace)
            VehicleWorkAction.Seat -> seat(workspace.profile)
            VehicleWorkAction.VoiceNote -> note(workspace)
            VehicleWorkAction.Music -> music()
            VehicleWorkAction.Logout, VehicleWorkAction.ChangeDriver, VehicleWorkAction.Refresh -> Unit
        }
    }

    fun clear() {
        revision++
        platform.stopSpeech()
        platform.cancelSeat()
        dismiss()
    }

    fun close() {
        closed = true
        clear()
        notes.shutdownNow()
    }

    private fun destination(visit: Visit) {
        val candidate = navigationTarget(visit)
        val actions = if (candidate == null) listOf(Action("완료", run = ::dismiss))
        else listOf(Action("내비로 보내기") { sendDestination(candidate) }, Action("돌아가기", false, ::dismiss))
        showSheet("방문 장소 확인", "방문 주소와 변경 근거를 확인하세요.", actions) { panel ->
            panel.append(heading(listOf(visit.title, visit.time).filter(String::isNotBlank).joinToString(" · "), 36))
            panel.append(label("방문 주소   " + visit.address.ifBlank { "미정" }, 29, Font.Medium), 14)
            visit.changedFrom?.let { panel.append(label("기존 주소   $it", 27, color = MUTED), 12) }
            visit.evidence?.let {
                panel.divider(20)
                panel.append(label(it, 26, color = SKY), 16)
            }
            if (candidate == null) {
                panel.append(label("이 주소의 Pleos 지점 정보가 준비되면 경로 안내를 시작할 수 있습니다.", 26, color = MUTED), 18)
            }
        }
    }

    private fun navigationTarget(visit: Visit): PleosDestination? {
        val latitude = visit.latitude ?: return null
        val longitude = visit.longitude ?: return null
        val poi = visit.poiId?.takeIf(String::isNotBlank) ?: return null
        if (visit.address.isBlank()) return null
        return PleosDestination(visit.poiName ?: visit.title, visit.address, latitude, longitude, poi)
    }

    private fun sendDestination(candidate: PleosDestination) {
        showSheet("Pleos 내비게이션", "경로 요청 중", emptyList()) { panel ->
            panel.append(heading(candidate.title, 34))
            panel.append(label(candidate.address, 28, color = MUTED), 12)
        }
        val expected = revision
        onNavigationPending(candidate)
        platform.navigate(candidate) { outcome ->
            onNavigationPending(null)
            if (valid(expected)) result("Pleos 내비게이션", outcome.message)
        }
    }

    fun resumeNavigation(candidate: PleosDestination) {
        if (!allowed()) return
        showSheet("Pleos 내비게이션", "기본 내비에서 설정된 목적지를 확인합니다.", emptyList()) { panel ->
            panel.append(heading(candidate.title, 34))
        }
        val expected = revision
        platform.confirmNavigation(candidate) { outcome ->
            if (valid(expected)) result("Pleos 내비게이션", outcome.message)
        }
    }

    private fun briefing(workspace: Workspace) {
        val summary = workspace.briefing
        val description = when (summary.source) {
            "ai" -> "AI 요약 · 선택한 메일과 일정"
            "extractive" -> "원문 기반 요약 · 선택한 메일과 일정"
            else -> "시연 업무 브리핑"
        }
        val actions = if (workspace.profile.speakBriefing && summary.text.isNotBlank()) {
            listOf(Action("브리핑 듣기") { speak(workspace) }, Action("돌아가기", false, ::dismiss))
        } else listOf(Action("돌아가기", false, ::dismiss))
        showSheet("업무 브리핑", description, actions) { panel ->
            panel.append(heading(summary.text.ifBlank { "선택된 브리핑이 없습니다." }, 35))
            for (message in workspace.messages.take(3)) {
                panel.divider(20)
                panel.append(label(listOf("관련 메일", message.receivedAt, message.sender).filter(String::isNotBlank)
                    .joinToString(" · "), 24, Font.Medium, SKY), 16)
                panel.append(label(message.subject, 28, Font.Bold), 8)
                if (message.preview.isNotBlank()) panel.append(label(message.preview, 24, color = MUTED), 8)
            }
        }
    }

    private fun speak(workspace: Workspace) {
        showSheet("브리핑 재생", "Pleos 음성 서비스에 요청했습니다.", listOf(Action("재생 중지") {
            platform.stopSpeech()
            briefing(workspace)
        })) { panel -> panel.append(heading(workspace.briefing.text, 35)) }
        val expected = revision
        platform.speak(workspace.briefing.text) { outcome ->
            if (valid(expected)) result("업무 브리핑", outcome.message, Action("브리핑으로") { briefing(workspace) })
        }
    }

    private fun seat(profile: DriverProfile) {
        showSheet("시트 프리셋", "정차 상태에서 내 휴대폰 설정을 적용합니다.", listOf(Action("돌아가기", false, ::dismiss))) { panel ->
            panel.append(heading(preset(profile), 37))
            panel.append(label("운전석 지원 범위 확인 중", 27, color = MUTED), 15)
        }
        val expected = revision
        platform.readSeat { response ->
            if (!valid(expected)) return@readSeat
            response.onSuccess { axes -> confirmSeat(profile, axes) }.onFailure { error ->
                result("시트 프리셋", preset(profile) + "\n" + (error.message ?: "좌석 상태를 확인할 수 없습니다."))
            }
        }
    }

    private fun confirmSeat(profile: DriverProfile, axes: PleosSeatState) {
        showSheet("시트 프리셋", "적용하면 지원되는 운전석 위치가 이동합니다.",
            listOf(Action("프리셋 적용") { applySeat(profile, axes) }, Action("돌아가기", false, ::dismiss))) { panel ->
            panel.append(heading(preset(profile), 39))
            panel.append(label("현재 높이 " + (axes.height?.let { "${axisPercent(it)}%" } ?: "지원 확인 불가"), 28, color = MUTED), 15)
            panel.append(label("현재 앞뒤 위치 " + (axes.foreAft?.let { "${axisPercent(it)}%" } ?: "지원 확인 불가"), 28, color = MUTED), 8)
        }
    }

    private fun applySeat(profile: DriverProfile, axes: PleosSeatState) {
        showSheet("시트 설정 적용 중", "운전석 이동 결과를 확인합니다.",
            listOf(Action("이동 중지") {
                platform.cancelSeat()
                result("시트 이동 중지", "좌석 이동을 중지했습니다.")
            })) { panel -> panel.append(heading(preset(profile), 38)) }
        val expected = revision
        platform.applySeat(target(axes.height, profile.seatHeight), target(axes.foreAft, profile.seatPosition)) { outcome ->
            if (valid(expected)) result(if (outcome.success) "시트 설정 적용 완료" else "시트 설정 결과", outcome.message)
        }
    }

    private fun preset(profile: DriverProfile) = "높이 ${profile.seatHeight}%     앞뒤 위치 ${profile.seatPosition}%"
    private fun axisPercent(axis: PleosSeatAxis): Int = ((axis.position - axis.minimum) * 100.0 / (axis.maximum - axis.minimum)).roundToInt()
    private fun target(axis: PleosSeatAxis?, percent: Int): Int = axis?.let {
        (it.minimum + (it.maximum - it.minimum) * percent.coerceIn(0, 100) / 100.0).roundToInt()
    } ?: 0

    private fun note(workspace: Workspace) {
        val visit = workspace.visits.firstOrNull()
        val actions = buildList {
            add(Action("말하기 시작") { record(workspace) })
            if (BuildConfig.DEBUG && activity.assets.list("")?.contains(STT_FIXTURE) == true) {
                add(Action("시험 음성 인식", false) {
                    val sample = activity.assets.open(STT_FIXTURE).use { it.readBytes() }
                    record(workspace, sample)
                })
            }
            add(Action("돌아가기", false, ::dismiss))
        }
        showSheet("음성 메모", "정차 중에 방문 업무 메모를 남길 수 있습니다.", actions) { panel ->
            panel.append(heading(visit?.title ?: "새 업무 메모", 35))
            if (workspace.notes.isNotEmpty()) {
                panel.divider(20)
                panel.append(label("업무 노트", 24, Font.Medium, SKY), 16)
                workspace.notes.take(3).forEach { linked ->
                    panel.append(button(linked.title, primary = false) { openNote(workspace, linked) }, 12)
                }
            }
        }
    }

    private fun openNote(workspace: Workspace, note: WorkNote) {
        val back = Action("돌아가기", false) { note(workspace) }
        result(note.title, "선택한 업무 노트를 불러오는 중입니다.", back)
        val expected = revision
        notes.execute {
            val response = runCatching { workspaceApi.readNote(session.token, note.id) }
            main.post {
                if (!valid(expected)) return@post
                response.onSuccess { content ->
                    result(note.title, content.ifBlank { "이 노트에 표시할 텍스트가 없습니다." }, back)
                }.onFailure {
                    if (it is WorkspaceSessionEnded) onSessionEnded()
                    else result(note.title, "업무 노트를 불러오지 못했습니다.", back)
                }
            }
        }
    }

    private fun record(workspace: Workspace, sample: ByteArray? = null) {
        val instruction = if (sample == null) "메모를 말씀해 주세요. 말이 끝나면 확인 화면을 엽니다."
            else "한국어 시험 음성을 인식하고 있습니다."
        showSheet("음성 메모 녹음", instruction,
            listOf(Action("녹음 취소") {
                platform.stopSpeech()
                note(workspace)
            })) { panel ->
            panel.append(heading(workspace.visits.firstOrNull()?.title ?: "새 업무 메모", 35))
        }
        val expected = revision
        platform.listen(sample) { response ->
            if (!valid(expected)) return@listen
            response.onSuccess { review(workspace, NoteDraft(it, workspace.visits.firstOrNull())) }.onFailure { error ->
                result("음성 인식 결과", error.message ?: "인식 결과를 받지 못했습니다.", Action("돌아가기") { note(workspace) })
            }
        }
    }

    private fun review(workspace: Workspace, draft: NoteDraft, retry: Boolean = false) {
        val design = dialogDesign()
        val editor = EditText(activity).apply {
            setText(draft.text)
            filters = arrayOf(InputFilter.LengthFilter(3_000))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            minLines = 3
            maxLines = 6
            gravity = Gravity.TOP or Gravity.START
            typeface = design.typeface(Font.Medium)
            textSize = 25f
            setTextColor(TEXT)
            hint = "메모 내용"
            setHintTextColor(MUTED)
            background = design.rounded(BACKGROUND, 12, LINE, 2)
            val padding = design.px(16)
            setPadding(padding, padding, padding, padding)
        }
        showSheet("음성 메모 확인", if (retry) "저장 응답을 받지 못했습니다. 같은 내용으로 다시 시도할 수 있습니다."
            else "저장하기 전에 인식된 내용을 확인하세요.",
            listOf(Action(if (retry) "다시 저장" else "업무 메모 저장") {
                val text = editor.text.toString().trim()
                if (text.isBlank()) editor.error = "메모를 입력하세요."
                else save(workspace, if (text == draft.text) draft else NoteDraft(text, draft.visit))
            }, Action("다시 녹음", false) { record(workspace) }, Action("취소", false, ::dismiss))) { panel ->
            panel.isFocusableInTouchMode = true
            panel.append(editor)
            panel.append(label(if (workspace.source == "microsoft365") "저장 위치 · 연결한 OneNote"
                else "저장 위치 · 시연 업무 메모", 25, color = SKY), 15)
            panel.requestFocus()
        }
    }

    private fun save(workspace: Workspace, draft: NoteDraft) {
        showSheet("업무 메모 저장 중", "", emptyList()) { panel -> panel.append(heading("저장 결과를 확인합니다.", 34)) }
        val expected = revision
        notes.execute {
            val response = runCatching { workspaceApi.saveNote(session.token, draft.text, draft.visit?.id, draft.requestId) }
            main.post {
                if (!valid(expected)) return@post
                response.onSuccess { source ->
                    val place = if (source == "microsoft365") "OneNote" else "시연 업무 메모"
                    result("업무 메모 저장 완료", "저장 위치 · $place", Action("오늘 방문 업무") {
                        dismiss()
                        notifyChanged()
                    })
                }.onFailure {
                    if (it is WorkspaceSessionEnded) onSessionEnded()
                    else review(workspace, draft, retry = true)
                }
            }
        }
    }

    private fun music() {
        showSheet("휴대폰 음악", "정차 중 차량과 휴대폰의 오디오 연결을 확인합니다.",
            listOf(Action("Bluetooth 설정") { openBluetooth() }, Action("오늘 방문 업무", false, ::dismiss))) { panel ->
            panel.append(heading("휴대폰에서 음악을 재생하세요", 38))
            panel.append(label("Pleos에서 휴대폰을 페어링하고 차량의 미디어 소스로 선택하세요.", 28, color = MUTED), 16)
        }
    }

    private fun openBluetooth() {
        try {
            activity.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) {
            result("휴대폰 음악", "Pleos의 시스템 설정에서 Bluetooth를 열어 주세요.")
        } catch (_: SecurityException) {
            result("휴대폰 음악", "Pleos의 시스템 설정에서 Bluetooth를 열어 주세요.")
        }
    }

    private fun result(title: String, message: String, action: Action = Action("오늘 방문 업무", run = ::dismiss)) {
        showSheet(title, "", listOf(action)) { panel -> panel.append(label(message, 29, Font.Medium)) }
    }

    private fun dismiss() {
        val current = dialog
        dialog = null
        current?.dismiss()
    }

    private fun allowed() = !closed && canWork()
    private fun valid(expected: Int) = allowed() && expected == revision && dialog != null

    private fun dialogDesign(): ShiftVehicleDesign {
        val width = activity.window.decorView.width / activity.resources.displayMetrics.density
        return ShiftVehicleDesign(activity, (width / 860f).coerceIn(0.67f, 1f))
    }

    private fun showSheet(title: String, subtitle: String, actions: List<Action>, content: ShiftVehicleDesign.(LinearLayout) -> Unit) {
        if (!allowed()) return
        revision++
        dismiss()
        val design = dialogDesign()
        val shell = with(design) {
            val column = card(38, BACKGROUND).apply {
                background = rounded(BACKGROUND, 35, LINE, 2)
                append(label("SHIFT", 27, Font.Logo, SKY))
                append(heading(title, 48), 16)
                if (subtitle.isNotBlank()) append(label(subtitle, 27, color = MUTED), 13)
                append(card(31).also { content(this@with, it) }, 24)
                for (action in actions) {
                    append(button(action.title, action.primary) {
                        if (allowed()) action.run()
                    }, 14)
                }
            }
            ScrollView(activity).apply {
                isFillViewport = true
                addView(column)
            }
        }
        val sheet = Dialog(activity)
        dialog = sheet
        sheet.setContentView(shell)
        sheet.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        sheet.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
        sheet.setOnDismissListener {
            if (dialog === sheet) {
                dialog = null
                revision++
                platform.stopSpeech()
                platform.cancelSeat()
            }
        }
        sheet.show()
        val display = activity.window.decorView
        val width = minOf((display.width * 0.93f).roundToInt(), design.px(960))
        val measured = shell.getChildAt(0)
        measured.measure(
            android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY),
            android.view.View.MeasureSpec.makeMeasureSpec(0, android.view.View.MeasureSpec.UNSPECIFIED),
        )
        val height = minOf(measured.measuredHeight, (display.height * 0.91f).roundToInt())
        sheet.window?.setLayout(width, height)
    }

    private companion object {
        const val STT_FIXTURE = "shift-stt-fixture.pcm"
    }
}
