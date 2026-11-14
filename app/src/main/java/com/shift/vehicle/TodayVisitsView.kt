package com.shift.vehicle

import android.content.Context
import android.content.res.ColorStateList
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
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import kotlin.math.ceil
import kotlin.math.roundToInt

internal class TodayVisitsView(
    context: Context,
    private val onSendToNavigation: (String) -> Unit,
    private val employeeName: String,
) : ScrollView(context) {
    private val astaBold = loadFont("asta_sans.ttf", 700)
    private val notoRegular = loadFont("noto_sans_kr.ttf", 400)
    private val notoMedium = loadFont("noto_sans_kr.ttf", 500)
    private val notoBold = loadFont("noto_sans_kr.ttf", 700)
    private val visits = if (employeeName == "직원 B") EMPLOYEE_B_VISITS else EMPLOYEE_A_VISITS
    private var laidOutWidth = 0
    private var designScale = 1f

    init {
        isFillViewport = true
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        isFocusable = false
        layoutDirection = View.LAYOUT_DIRECTION_LTR
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val availableWidth = MeasureSpec.getSize(widthMeasureSpec)
        if (availableWidth > 0 && availableWidth != laidOutWidth) {
            laidOutWidth = availableWidth
            val widthDp = availableWidth / resources.displayMetrics.density
            val wide = widthDp >= WIDE_BREAKPOINT
            designScale = (widthDp / if (wide) WIDE_REFERENCE else COMPACT_REFERENCE).coerceAtMost(1f)
            background = rounded(NAVY, 40)
            clipToOutline = true
            removeAllViews()
            addView(buildContent(wide), FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    private fun buildContent(wide: Boolean): LinearLayout = vertical().apply {
        val inset = px(if (wide) 64 else 48)
        setPadding(inset, inset, inset, inset)
        addView(buildHeader(), LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        if (wide) {
            val columns = horizontal().apply {
                setPadding(0, 0, px(8), 0)
                addView(
                    buildNextVisit(wide = true),
                    LinearLayout.LayoutParams(0, WRAP_CONTENT, 958f),
                )
                addView(
                    buildLaterVisits(),
                    LinearLayout.LayoutParams(0, WRAP_CONTENT, 550f).apply {
                        marginStart = px(56)
                    },
                )
            }
            append(columns, top = 52)
        } else {
            append(buildNextVisit(wide = false), top = 42)
            append(buildLaterVisits(), top = 42)
        }
    }

    private fun buildHeader(): LinearLayout = vertical().apply {
        append(horizontal().apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(label("SHIFT", 34, astaBold, SKY_BLUE), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            addView(label(employeeName, 28, notoMedium, TEXT_MUTED), LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        })
        append(label("오늘 방문 업무", 60, notoBold).apply { isAccessibilityHeading = true }, top = 14)
    }

    private fun buildNextVisit(wide: Boolean): LinearLayout = vertical().apply {
        val padding = px(if (wide) 48 else 38)
        setPadding(padding, padding, padding, padding)
        background = rounded(HYUNDAI_BLUE, 28)

        append(label("다음 방문", 28, notoMedium, SKY_BLUE).apply { isAccessibilityHeading = true })
        append(label(visits.time, if (wide) 64 else 50, astaBold), top = 18)
        append(label(visits.title, if (wide) 49 else 42, notoBold), top = 18)
        append(label(visits.address, 30, notoRegular), top = 18)
        append(label(visits.change, 27, notoMedium, SKY_BLUE), top = 18)
        addView(buildNavigationButton(), LinearLayout.LayoutParams(px(344), WRAP_CONTENT).apply {
            topMargin = px(18)
        })
    }

    private fun buildNavigationButton(): Button = Button(context).apply {
        text = "내비로 보내기"
        typeface = notoBold
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 32 * designScale)
        setTextColor(NAVY)
        gravity = Gravity.CENTER
        isAllCaps = false
        letterSpacing = 0f
        includeFontPadding = false
        minHeight = maxOf(px(104), (48 * resources.displayMetrics.density).roundToInt())
        minWidth = 0
        setPadding(px(20), px(12), px(20), px(12))
        backgroundTintList = null
        stateListAnimator = null

        val surfaces = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), rounded(SKY_BLUE, 20, TEXT, 5))
            addState(intArrayOf(), rounded(SKY_BLUE, 20))
        }
        background = RippleDrawable(
            ColorStateList.valueOf(0x260B1728), surfaces, rounded(Color.WHITE, 20),
        )
        setOnClickListener { onSendToNavigation(visits.address) }
    }

    private fun buildLaterVisits(): LinearLayout = vertical().apply {
        append(label("이후 일정", 30, notoBold).apply { isAccessibilityHeading = true })
        appendDivider()
        for ((time, title) in visits.later) {
            val row = horizontal().apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(label(time, 32, astaBold, TEXT_MUTED), LinearLayout.LayoutParams(px(108), WRAP_CONTENT))
                addView(label(title, 30, notoMedium), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply {
                    marginStart = px(28)
                })
            }
            append(row, top = 22)
            appendDivider()
        }
    }

    private fun label(copy: String, size: Int, font: Typeface, color: Int = TEXT): TextView = TextView(context).apply {
        text = copy
        typeface = font
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size * designScale)
        setTextColor(color)
        gravity = Gravity.CENTER_VERTICAL
        includeFontPadding = false
        val lineHeightSp = ceil(size * 1.35f)
        val lineHeightPx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP, lineHeightSp * designScale, resources.displayMetrics,
        ).roundToInt()
        setLineHeight(lineHeightPx)
        minHeight = lineHeightPx
    }

    private fun vertical() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }

    private fun horizontal() = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }

    private fun LinearLayout.append(child: View, top: Int = 0) {
        addView(child, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
            topMargin = px(top)
        })
    }

    private fun LinearLayout.appendDivider() {
        val divider = View(context).apply {
            setBackgroundColor(DIVIDER)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        addView(divider, LinearLayout.LayoutParams(MATCH_PARENT, px(2)).apply {
            topMargin = px(22)
        })
    }

    private fun rounded(color: Int, radius: Int, strokeColor: Int = Color.TRANSPARENT, strokeWidth: Int = 0) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = px(radius).toFloat()
            if (strokeWidth > 0) setStroke(px(strokeWidth), strokeColor)
        }

    private fun px(dp: Int): Int = (dp * designScale * resources.displayMetrics.density).roundToInt()

    private fun loadFont(fileName: String, weight: Int): Typeface =
        Typeface.Builder(context.assets, "fonts/$fileName")
            .setFontVariationSettings("'wght' $weight")
            .setWeight(weight)
            .build()
            ?: Typeface.create(Typeface.DEFAULT, weight, false)

    private data class DemoVisits(
        val time: String,
        val title: String,
        val address: String,
        val change: String,
        val later: List<Pair<String, String>>,
    )

    private companion object {
        const val WIDE_BREAKPOINT = 1200f
        const val WIDE_REFERENCE = 1700f
        const val COMPACT_REFERENCE = 840f

        val NAVY = Color.rgb(11, 23, 40)
        val HYUNDAI_BLUE = Color.rgb(0, 44, 95)
        val SKY_BLUE = Color.rgb(170, 202, 230)
        val TEXT = Color.rgb(247, 248, 250)
        val TEXT_MUTED = Color.rgb(175, 192, 213)
        val DIVIDER = Color.rgb(43, 62, 86)

        val EMPLOYEE_A_VISITS = DemoVisits(
            time = "10:30",
            title = "한빛모빌리티 미팅",
            address = "경기 성남시 분당구 판교역로 235",
            change = "장소 변경 · 09:12 수신 메일",
            later = listOf("13:00" to "성우테크 방문", "15:20" to "서진솔루션 미팅"),
        )
        val EMPLOYEE_B_VISITS = DemoVisits(
            time = "11:00",
            title = "한결로보틱스 방문",
            address = "경기 수원시 영통구 광교로 145",
            change = "장소 변경 · 09:40 수신 메일",
            later = listOf("14:00" to "가온테크 미팅", "16:10" to "동림솔루션 방문"),
        )
    }
}
