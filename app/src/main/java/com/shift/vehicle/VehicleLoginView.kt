package com.shift.vehicle

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import com.shift.vehicle.ShiftVehicleDesign.Companion.BACKGROUND
import com.shift.vehicle.ShiftVehicleDesign.Companion.ERROR_PANEL
import com.shift.vehicle.ShiftVehicleDesign.Companion.ERROR_TEXT
import com.shift.vehicle.ShiftVehicleDesign.Companion.MUTED
import com.shift.vehicle.ShiftVehicleDesign.Companion.NOTICE
import com.shift.vehicle.ShiftVehicleDesign.Companion.NOTICE_TEXT
import com.shift.vehicle.ShiftVehicleDesign.Companion.QR_PANEL
import com.shift.vehicle.ShiftVehicleDesign.Companion.SKY

internal class VehicleLoginView(
    context: Context,
    private val onRetry: () -> Unit,
    private val onCancel: () -> Unit = {},
) : ScrollView(context) {
    enum class Purpose(val title: String, val instructions: String?) {
        LOGIN("공용차 로그인", "휴대폰으로 QR을 스캔한 뒤 PIN을 입력해 주세요."),
        HANDOVER("운전자 교대", "다음 운전자가 QR을 스캔하고 PIN으로 승인하세요."),
        LOGOUT("QR 로그아웃", "현재 운전자의 휴대폰으로 스캔하고 로그아웃을 승인하세요."),
        WORKSPACE("오늘 방문 업무", null),
    }

    private sealed interface LoginState {
        data class Loading(val message: String) : LoginState
        data class Waiting(val qr: Bitmap, val pin: String?) : LoginState
        data class Error(val message: String, val retryable: Boolean) : LoginState
    }

    private var purpose = Purpose.LOGIN
    private var canCancel = false
    private var state: LoginState = LoginState.Loading("로그인 요청을 준비하고 있습니다.")
    private var lastWidth = 0
    private var lastHeight = 0
    private var wide = false
    private var sideBySide = false
    private var design = ShiftVehicleDesign(context, 1f)

    init {
        isFillViewport = true
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        layoutDirection = View.LAYOUT_DIRECTION_LTR
        setBackgroundColor(BACKGROUND)
    }

    fun showLoading(
        purpose: Purpose = Purpose.LOGIN,
        message: String = "로그인 요청을 준비하고 있습니다.",
        cancelable: Boolean = false,
    ) = render(purpose, LoginState.Loading(message), cancelable)

    fun showRequest(qr: Bitmap, pin: String?, purpose: Purpose = Purpose.LOGIN) =
        render(purpose, LoginState.Waiting(qr, pin), purpose != Purpose.LOGIN)

    fun showError(message: String, cancelable: Boolean = false) =
        render(purpose, LoginState.Error(message, retryable = true), cancelable)

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val height = MeasureSpec.getSize(heightMeasureSpec)
        if (width > 0 && (width != lastWidth || height != lastHeight)) {
            lastWidth = width
            lastHeight = height
            val widthDp = width / resources.displayMetrics.density
            wide = widthDp >= 1200f
            design = ShiftVehicleDesign(context, (widthDp / if (wide) 1700f else 840f).coerceAtMost(1f))
            sideBySide = wide || (widthDp >= 720f && height > 0 && height < design.px(1_040))
            background = design.rounded(BACKGROUND, 40)
            clipToOutline = true
            rebuild()
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    private fun render(nextPurpose: Purpose, next: LoginState, cancelable: Boolean) {
        if (purpose == nextPurpose && state == next && canCancel == cancelable) return
        purpose = nextPurpose
        state = next
        canCancel = cancelable
        if (lastWidth > 0) rebuild()
    }

    private fun rebuild() = with(design) {
        val body = vertical().apply {
            val inset = px(if (wide) 64 else 48)
            setPadding(inset, inset, inset, inset)
            append(wordmark(), width = WRAP_CONTENT)
            append(heading(purpose.title, 60), 24)
            purpose.instructions?.let { append(label(it, 30, color = MUTED), 18) }

            when (val current = state) {
                is LoginState.Loading -> append(messageCard(current.message, loading = true), 34)
                is LoginState.Waiting -> append(requestCard(current), 34)
                is LoginState.Error -> append(messageCard(current.message, retryable = current.retryable), 34)
            }
            if (canCancel) append(button("취소", primary = false) { onCancel() }, 24, WRAP_CONTENT)
        }

        removeAllViews()
        addView(body, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private fun requestCard(waiting: LoginState.Waiting) = with(design) {
        val qrSize = px(when {
            wide -> 352
            sideBySide -> 248
            else -> 272
        })
        val qr = ImageView(context).apply {
            setImageBitmap(waiting.qr)
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = rounded(Color.WHITE, 20)
            val inset = px(16)
            setPadding(inset, inset, inset, inset)
            contentDescription = if (purpose == Purpose.LOGOUT) "로그아웃 QR 코드" else "로그인 QR 코드"
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }

        card(if (wide) 42 else 32, QR_PANEL).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            if (sideBySide) {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                addView(qr, LinearLayout.LayoutParams(qrSize, qrSize).apply {
                    marginEnd = px(if (wide) 48 else 32)
                })
                addView(vertical().apply {
                    append(vehicleName())
                    waiting.pin?.let { append(pinBlock(it, centered = false), 24) }
                    append(statusLine(centered = false), 24)
                }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            } else {
                append(vehicleName(centered = true))
                addView(qr, LinearLayout.LayoutParams(qrSize, qrSize).apply {
                    topMargin = px(22)
                    gravity = Gravity.CENTER_HORIZONTAL
                })
                waiting.pin?.let { append(pinBlock(it, centered = true), 18) }
                append(statusLine(centered = true), 18)
            }
        }
    }

    private fun pinBlock(pin: String, centered: Boolean) = with(design) {
        vertical().apply {
            val alignment = if (centered) Gravity.CENTER else Gravity.CENTER_VERTICAL
            append(label("차량 화면의 6자리 PIN", 24, color = MUTED).apply { gravity = alignment })
            append(label(pin, if (wide) 68 else 54, Font.Numeric).apply {
                gravity = alignment
                letterSpacing = 0.2f
                fontFeatureSettings = "\"tnum\" 1"
                contentDescription = pin.toList().joinToString(" ")
            }, 6)
        }
    }

    private fun statusLine(centered: Boolean) = with(design) {
        horizontal().apply {
            gravity = if (centered) Gravity.CENTER else Gravity.CENTER_VERTICAL
            addView(View(context).apply {
                background = rounded(SKY, 6)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(px(10), px(10)).apply { marginEnd = px(12) })
            addView(label("휴대폰 승인 대기 중", 25, Font.Medium, SKY).apply {
                accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
            })
        }
    }

    private fun messageCard(message: String, loading: Boolean = false, retryable: Boolean = false) = with(design) {
        card(if (wide) 42 else 32, if (retryable) ERROR_PANEL else NOTICE).apply {
            if (purpose != Purpose.WORKSPACE) append(vehicleName())
            if (loading) {
                addView(ProgressBar(context).apply {
                    indeterminateTintList = ColorStateList.valueOf(SKY)
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, LinearLayout.LayoutParams(px(48), px(48)).apply { topMargin = px(24) })
            }
            append(label(message, 30, color = if (retryable) ERROR_TEXT else NOTICE_TEXT).apply {
                accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
            }, 20)
            if (retryable) append(button("다시 시도", primary = true) { onRetry() }, 24, WRAP_CONTENT)
        }
    }

    private fun vehicleName(centered: Boolean = false) = design.label("공용차 01", 29, Font.Medium).apply {
        if (centered) gravity = Gravity.CENTER
    }
}
