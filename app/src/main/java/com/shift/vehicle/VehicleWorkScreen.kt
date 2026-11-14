package com.shift.vehicle

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
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
import android.widget.ScrollView
import android.widget.TextView
import com.shift.vehicle.ShiftVehicleDesign.Companion.HYUNDAI
import com.shift.vehicle.ShiftVehicleDesign.Companion.MUTED
import com.shift.vehicle.ShiftVehicleDesign.Companion.SKY
import kotlin.math.ceil
import kotlin.math.roundToInt

internal enum class VehicleAvailability { PARKED, RESTRICTED }

internal sealed interface VehicleWorkAction {
    data class Destination(val visit: Visit) : VehicleWorkAction
    data object Briefing : VehicleWorkAction
    data object Seat : VehicleWorkAction
    data object VoiceNote : VehicleWorkAction
    data object VisitMemos : VehicleWorkAction
    data object Music : VehicleWorkAction
    data object Logout : VehicleWorkAction
    data object ChangeDriver : VehicleWorkAction
    data object Refresh : VehicleWorkAction
}

internal class VehicleWorkScreen(
    context: Context,
    private val workspace: Workspace,
    private val employeeName: String,
    private val availability: VehicleAvailability,
    private val onAction: (VehicleWorkAction) -> Unit,
) : ScrollView(context) {
    private val parked = availability == VehicleAvailability.PARKED
    private var laidOutWidth = 0
    private var design = ShiftVehicleDesign(context, 1f)

    init {
        isFillViewport = true
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        isFocusable = false
        layoutDirection = View.LAYOUT_DIRECTION_LTR
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        if (width > 0 && width != laidOutWidth) {
            laidOutWidth = width
            val widthDp = width / resources.displayMetrics.density
            val wide = widthDp >= 1200f
            design = ShiftVehicleDesign(context, (widthDp / if (wide) 1700f else 840f).coerceAtMost(1f))
            background = design.rounded(ShiftVehicleDesign.BACKGROUND, 40)
            clipToOutline = true
            removeAllViews()
            addView(content(wide), FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    private fun content(wide: Boolean) = with(design) {
        vertical().apply {
            val inset = px(if (wide) 64 else 48)
            setPadding(inset, inset, inset, inset)
            append(horizontal().apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(wordmark())
                addView(View(context), LinearLayout.LayoutParams(0, 1, 1f))
                val state = if (parked) "정차 중" else "주차 확인 필요"
                addView(label("$employeeName  ·  $state", if (wide) 24 else 22, Font.Medium, MUTED))
            })
            append(heading("오늘 방문 업무", 60), 24)
            val visit = workspace.visits.firstOrNull()
            when {
                visit == null -> append(card(42).apply {
                    append(heading("오늘 예정된 방문이 없습니다", 40))
                    if (parked) append(label("휴대폰의 업무 계정과 일정 연결을 확인하세요.", 29, color = MUTED), 16)
                }, 42)
                wide && parked -> append(horizontal().apply {
                    addView(nextVisit(visit, true), LinearLayout.LayoutParams(0, WRAP_CONTENT, 60f))
                    addView(laterVisits(), LinearLayout.LayoutParams(0, WRAP_CONTENT, 40f).apply {
                        marginStart = px(40)
                    })
                }, 42)
                else -> {
                    append(nextVisit(visit, false), 36)
                    if (parked) append(laterVisits(), 32)
                }
            }
            if (parked) {
                val actions = listOf(
                    Triple("업무 브리핑", VehicleWorkAction.Briefing, true),
                    Triple("시트 설정", VehicleWorkAction.Seat, false),
                    Triple("음성 메모", VehicleWorkAction.VoiceNote, false),
                    Triple("방문 메모", VehicleWorkAction.VisitMemos, false),
                )
                actions.chunked(if (wide) 4 else 2).forEach { append(actionRow(it), 22) }
                val session = listOf(
                    Triple("휴대폰 음악", VehicleWorkAction.Music, false),
                    Triple("QR 로그아웃", VehicleWorkAction.Logout, false),
                    Triple("운전자 교대", VehicleWorkAction.ChangeDriver, false),
                    Triple("새로고침", VehicleWorkAction.Refresh, false),
                )
                session.chunked(if (wide) 4 else 2).forEach { append(actionRow(it), 20) }
            } else {
                append(notice("시트, 목적지 변경, 메모와 로그아웃은 주차 후 이용할 수 있습니다."), 34)
            }
        }
    }

    private fun nextVisit(visit: Visit, wide: Boolean) = with(design) {
        card(if (wide) 44 else 36, HYUNDAI).apply {
            append(label("다음 방문", 27, Font.Medium, SKY))
            if (visit.time.isNotBlank()) append(label(visit.time, if (wide) 58 else 52, Font.Numeric), 14)
            append(heading(visit.title, if (wide) 46 else 42), 12)
            if (parked) {
                append(label(visit.address.ifBlank { "방문 주소 미정" }, 29), 12)
                visit.evidence?.let { append(label(it, 27, Font.Medium, SKY), 12) }
                append(button(
                    if (visit.changedFrom != null) "변경 장소 · 내비로 보내기" else "목적지 확인",
                    primary = true,
                    icon = R.drawable.shift_navigation,
                ) { onAction(VehicleWorkAction.Destination(visit)) }, 20, WRAP_CONTENT)
            }
        }
    }

    private fun laterVisits() = with(design) {
        vertical().apply {
            setPadding(px(12), px(12), 0, 0)
            append(heading("이후 일정", 30))
            divider(18)
            val later = workspace.visits.drop(1)
            if (later.isEmpty()) append(label("예정된 일정 없음", 26, color = MUTED), 18)
            for (visit in later) {
                append(visitRow(visit.time, visit.title) { onAction(VehicleWorkAction.Destination(visit)) })
                divider(0)
            }
        }
    }

    private fun actionRow(actions: List<Triple<String, VehicleWorkAction, Boolean>>) = with(design) {
        horizontal().apply {
            for ((index, entry) in actions.withIndex()) {
                val (label, action, primary) = entry
                val icon = when (action) {
                    VehicleWorkAction.Briefing -> R.drawable.shift_volume_2
                    VehicleWorkAction.Seat -> R.drawable.shift_armchair
                    VehicleWorkAction.VoiceNote -> R.drawable.shift_mic
                    VehicleWorkAction.VisitMemos -> R.drawable.shift_book_open
                    VehicleWorkAction.Music -> R.drawable.shift_headphones
                    VehicleWorkAction.Logout -> R.drawable.shift_log_out
                    VehicleWorkAction.ChangeDriver -> R.drawable.shift_repeat_2
                    VehicleWorkAction.Refresh -> R.drawable.shift_refresh_cw
                    is VehicleWorkAction.Destination -> R.drawable.shift_navigation
                }
                addView(button(label, primary, icon) { onAction(action) }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply {
                    if (index > 0) marginStart = px(16)
                })
            }
        }
    }
}

internal enum class Font(val weight: Int, val asset: String = "noto_sans_kr.ttf") {
    Regular(400), Medium(500), Bold(700), NumericMedium(600, "asta_sans.ttf"), Numeric(650, "asta_sans.ttf"),
}

internal class ShiftVehicleDesign(private val context: Context, private val scale: Float) {
    fun vertical() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    fun horizontal() = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    fun card(padding: Int, color: Int = PANEL, radius: Int = 30) = vertical().apply {
        val inset = px(padding)
        setPadding(inset, inset, inset, inset)
        background = rounded(color, radius, PANEL_LINE, if (color == PANEL) 2 else 0)
    }

    fun wordmark(width: Int = 166) = ImageView(context).apply {
        setImageResource(R.drawable.shift_wordmark)
        scaleType = ImageView.ScaleType.FIT_CENTER
        contentDescription = context.getString(R.string.app_name)
        layoutParams = LinearLayout.LayoutParams(px(width), px((width * 112f / 640f).roundToInt()))
    }

    fun heading(copy: String, size: Int) = label(copy, size, Font.Bold).apply {
        isAccessibilityHeading = true
        letterSpacing = -0.035f
    }

    fun label(copy: String, size: Int, font: Font = Font.Regular, color: Int = TEXT) = TextView(context).apply {
        text = copy
        typeface = typeface(font)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size * scale)
        setTextColor(color)
        gravity = Gravity.CENTER_VERTICAL
        includeFontPadding = false
        if (font == Font.Numeric || font == Font.NumericMedium) fontFeatureSettings = "\"tnum\" 1"
        val lineHeight = sp(ceil(size * 1.4f).toInt()).roundToInt()
        setLineHeight(lineHeight)
        minHeight = lineHeight
    }

    fun button(copy: String, primary: Boolean, icon: Int? = null, action: () -> Unit) = Button(context).apply {
        text = copy
        typeface = typeface(Font.Bold)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 29 * scale)
        val colors = ColorStateList(
            arrayOf(intArrayOf(-android.R.attr.state_enabled), intArrayOf()),
            intArrayOf(if (primary) BACKGROUND else DISABLED_SKY, if (primary) BUTTON_INK else SKY),
        )
        setTextColor(colors)
        icon?.let { id ->
            val glyph = context.getDrawable(id)?.mutate()
            glyph?.setBounds(0, 0, px(30), px(30))
            setCompoundDrawablesRelative(glyph, null, null, null)
            compoundDrawablePadding = px(12)
            compoundDrawableTintList = colors
        }
        isAllCaps = false
        includeFontPadding = false
        minimumWidth = 0
        minWidth = 0
        minimumHeight = targetHeight(78)
        minHeight = minimumHeight
        setPadding(px(22), px(16), px(22), px(16))
        backgroundTintList = null
        stateListAnimator = null
        background = controlBackground(if (primary) SKY else Color.TRANSPARENT, 20,
            if (primary) Color.TRANSPARENT else BUTTON_LINE)
        setOnClickListener { action() }
    }

    fun visitRow(time: String, title: String, action: () -> Unit) = horizontal().apply {
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = targetHeight(88)
        setPadding(px(12), px(14), px(12), px(14))
        background = controlBackground(Color.TRANSPARENT, 10)
        isFocusable = true
        contentDescription = listOf(time, title).filter(String::isNotBlank).joinToString(" ")
        setAccessibilityDelegate(object : View.AccessibilityDelegate() {
            override fun onInitializeAccessibilityNodeInfo(host: View, info: android.view.accessibility.AccessibilityNodeInfo) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.className = Button::class.java.name
            }
        })
        if (time.isNotBlank()) {
            addView(label(time, 31, Font.NumericMedium, MUTED).apply {
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(px(106), WRAP_CONTENT).apply { marginEnd = px(22) })
        }
        addView(label(title, 29, Font.Medium).apply {
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        setOnClickListener { action() }
    }

    fun notice(copy: String) = card(24, NOTICE, 18).apply {
        append(label(copy, 27, color = NOTICE_TEXT))
    }

    fun noteBody(copy: String) = card(30, TEXT, 20).apply {
        append(label(copy, 29, color = NOTE_INK))
    }

    fun LinearLayout.append(child: View, top: Int = 0, width: Int = MATCH_PARENT) {
        val params = child.layoutParams
        val childWidth = if (width == WRAP_CONTENT) params?.width ?: width else width
        addView(child, LinearLayout.LayoutParams(childWidth, params?.height ?: WRAP_CONTENT).apply { topMargin = px(top) })
    }

    fun LinearLayout.divider(top: Int) {
        addView(View(context).apply {
            setBackgroundColor(LINE)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(MATCH_PARENT, maxOf(1, px(2))).apply { topMargin = px(top) })
    }

    fun rounded(color: Int, radius: Int, stroke: Int = Color.TRANSPARENT, strokeWidth: Int = 0) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = px(radius).toFloat()
            if (strokeWidth > 0) setStroke(maxOf(1, px(strokeWidth)), stroke)
        }

    fun px(dp: Int): Int = (dp * scale * context.resources.displayMetrics.density).roundToInt()
    fun sp(size: Int): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size * scale, context.resources.displayMetrics)

    private fun targetHeight(dp: Int) = maxOf(px(dp), (48f * context.resources.displayMetrics.density).roundToInt())

    private fun controlBackground(color: Int, radius: Int, outline: Int = Color.TRANSPARENT): Drawable {
        val stroke = if (outline == Color.TRANSPARENT) 0 else 2
        val states = StateListDrawable().apply {
            addState(intArrayOf(-android.R.attr.state_enabled), rounded(
                if (color == SKY) DISABLED_FILL else Color.TRANSPARENT, radius,
                if (stroke > 0) LINE else Color.TRANSPARENT, stroke,
            ))
            addState(intArrayOf(android.R.attr.state_focused), rounded(color, radius, TEXT, 4))
            addState(intArrayOf(), rounded(color, radius, outline, stroke))
        }
        return RippleDrawable(ColorStateList.valueOf(0x406482AA), states, rounded(Color.WHITE, radius))
    }

    fun typeface(font: Font): Typeface {
        return synchronized(faces) {
            faces.getOrPut(font) {
                Typeface.Builder(context.assets, "fonts/${font.asset}")
                    .setFontVariationSettings("'wght' ${font.weight}")
                    .setWeight(font.weight)
                    .build() ?: Typeface.create(Typeface.DEFAULT, font.weight, false)
            }
        }
    }

    companion object {
        private val faces = mutableMapOf<Font, Typeface>()
        val BACKGROUND = Color.rgb(11, 23, 40)
        val HYUNDAI = Color.rgb(0, 44, 95)
        val PANEL = Color.rgb(16, 33, 58)
        val SKY = Color.rgb(170, 202, 230)
        val TEXT = Color.rgb(247, 248, 250)
        val MUTED = Color.rgb(174, 190, 208)
        val LINE = Color.rgb(45, 64, 85)
        val PANEL_LINE = Color.rgb(43, 69, 98)
        val BUTTON_LINE = Color.rgb(59, 83, 109)
        val BUTTON_INK = Color.rgb(16, 39, 64)
        val QR_PANEL = Color.rgb(19, 40, 62)
        val NOTICE = Color.rgb(25, 49, 73)
        val NOTICE_TEXT = Color.rgb(193, 214, 233)
        val ERROR_PANEL = Color.rgb(67, 40, 44)
        val ERROR_TEXT = Color.rgb(255, 185, 169)
        val NOTE_INK = Color.rgb(23, 50, 78)
        val MEMO_EDITOR = Color.rgb(19, 42, 64)
        val MEMO_EDITOR_LINE = Color.rgb(61, 93, 126)
        private val DISABLED_FILL = Color.rgb(83, 107, 133)
        private val DISABLED_SKY = Color.rgb(121, 142, 164)
    }
}
