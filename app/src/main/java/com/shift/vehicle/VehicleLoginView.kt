package com.shift.vehicle

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.graphics.drawable.StateListDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import kotlin.math.ceil
import kotlin.math.roundToInt

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

    private val astaBold = font("asta_sans.ttf", 700)
    private val notoRegular = font("noto_sans_kr.ttf", 400)
    private val notoMedium = font("noto_sans_kr.ttf", 500)
    private val notoBold = font("noto_sans_kr.ttf", 700)
    private var purpose = Purpose.LOGIN
    private var canCancel = false
    private var state: LoginState = LoginState.Loading("로그인 요청을 준비하고 있습니다.")
    private var lastWidth = 0
    private var wide = false
    private var scale = 1f

    init {
        isFillViewport = true
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        layoutDirection = View.LAYOUT_DIRECTION_LTR
        setBackgroundColor(NAVY)
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
        if (width > 0 && width != lastWidth) {
            lastWidth = width
            val widthDp = width / resources.displayMetrics.density
            wide = widthDp >= 1200f
            scale = (widthDp / if (wide) 1700f else 840f).coerceAtMost(1f)
            background = rounded(NAVY, 40)
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

    private fun rebuild() {
        val body = column()
        val inset = px(if (wide) 64 else 48)
        body.setPadding(inset, inset, inset, inset)
        body.append(label("SHIFT", 34, astaBold, SKY_BLUE))
        body.append(label(purpose.title, 60, notoBold).apply { isAccessibilityHeading = true }, top = 14)
        purpose.instructions?.let { body.append(label(it, 30, notoRegular, MUTED), top = 18) }

        when (val current = state) {
            is LoginState.Loading -> body.append(messageCard(current.message, loading = true), top = 44)
            is LoginState.Waiting -> {
                body.append(requestCard(current), top = 44)
                body.append(statusLine(), top = 28)
            }
            is LoginState.Error -> body.append(messageCard(current.message, retryable = current.retryable), top = 44)
        }
        if (canCancel) {
            body.addView(actionButton("취소", ::cancel), LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
                topMargin = px(24)
            })
        }

        removeAllViews()
        addView(body, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private fun requestCard(waiting: LoginState.Waiting): LinearLayout {
        val vehicleAndPin = column().apply {
            append(vehicleName())
            val pin = waiting.pin
            if (pin != null) {
                append(label("일회용 PIN", 28, notoMedium, SKY_BLUE), top = if (wide) 36 else 22)
                append(label(pin, 68, astaBold).apply {
                    letterSpacing = 0.15f
                    contentDescription = pin.toList().joinToString(" ")
                }, top = 8)
            }
        }
        val size = px(if (wide) 352 else 292)
        val qr = ImageView(context).apply {
            setImageBitmap(waiting.qr)
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = rounded(Color.WHITE, 20)
            val inset = px(14)
            setPadding(inset, inset, inset, inset)
            contentDescription = if (purpose == Purpose.LOGOUT) "로그아웃 QR 코드" else "로그인 QR 코드"
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }

        return card().apply {
            if (wide) {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                addView(qr, LinearLayout.LayoutParams(size, size).apply {
                    marginEnd = px(48)
                })
                addView(vehicleAndPin, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            } else {
                addView(qr, LinearLayout.LayoutParams(size, size).apply { gravity = Gravity.CENTER_HORIZONTAL })
                append(vehicleAndPin, top = 28)
            }
        }
    }

    private fun statusLine() = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        addView(View(context).apply {
            background = rounded(SKY_BLUE, 6)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(px(12), px(12)).apply { marginEnd = px(14) })
        addView(label("휴대폰 승인 대기 중", 28, notoMedium, SKY_BLUE).apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
    }

    private fun messageCard(message: String, loading: Boolean = false, retryable: Boolean = false) = card().apply {
        if (purpose != Purpose.WORKSPACE) append(vehicleName())
        if (loading) {
            addView(ProgressBar(context).apply {
                indeterminateTintList = ColorStateList.valueOf(SKY_BLUE)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(px(48), px(48)).apply { topMargin = px(30) })
        }
        append(label(message, 30, notoRegular).apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }, top = 24)
        if (retryable) {
            addView(actionButton("다시 시도", onRetry), LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
                topMargin = px(30)
            })
        }
    }

    private fun cancel() = onCancel()

    private fun actionButton(label: String, action: () -> Unit) = Button(context).apply {
        text = label
        typeface = notoBold
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 30 * scale)
        setTextColor(NAVY)
        isAllCaps = false
        letterSpacing = 0f
        gravity = Gravity.CENTER
        minHeight = maxOf(px(84), (48 * resources.displayMetrics.density).roundToInt())
        setPadding(px(36), px(12), px(36), px(12))
        stateListAnimator = null
        backgroundTintList = null
        val backgroundStates = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), rounded(SKY_BLUE, 20, WHITE, 5))
            addState(intArrayOf(), rounded(SKY_BLUE, 20))
        }
        background = RippleDrawable(ColorStateList.valueOf(0x260B1728), backgroundStates, rounded(Color.WHITE, 20))
        setOnClickListener { action() }
    }

    private fun vehicleName() = label("현대 공용차 01", 40, notoBold)

    private fun card() = column().apply {
        val inset = px(if (wide) 48 else 36)
        setPadding(inset, inset, inset, inset)
        background = rounded(HYUNDAI_BLUE, 28)
    }

    private fun column() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }

    private fun label(value: String, size: Int, font: Typeface, color: Int = WHITE) = TextView(context).apply {
        text = value
        typeface = font
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size * scale)
        setTextColor(color)
        includeFontPadding = false
        gravity = Gravity.CENTER_VERTICAL
        val lineHeight = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP, ceil(size * 1.35f) * scale, resources.displayMetrics,
        ).roundToInt()
        setLineHeight(lineHeight)
        minHeight = lineHeight
    }

    private fun LinearLayout.append(child: View, top: Int = 0) {
        addView(child, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = px(top) })
    }

    private fun rounded(color: Int, radius: Int, outline: Int = Color.TRANSPARENT, strokeWidth: Int = 0) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = px(radius).toFloat()
            if (strokeWidth > 0) setStroke(px(strokeWidth), outline)
        }

    private fun px(dp: Int) = (dp * scale * resources.displayMetrics.density).roundToInt()

    private fun font(name: String, weight: Int) = Typeface.Builder(context.assets, "fonts/$name")
        .setFontVariationSettings("'wght' $weight")
        .setWeight(weight)
        .build()
        ?: Typeface.create(Typeface.DEFAULT, weight, false)

    private companion object {
        val NAVY = Color.rgb(11, 23, 40)
        val HYUNDAI_BLUE = Color.rgb(0, 44, 95)
        val SKY_BLUE = Color.rgb(170, 202, 230)
        val WHITE = Color.rgb(247, 248, 250)
        val MUTED = Color.rgb(175, 192, 213)
    }
}
