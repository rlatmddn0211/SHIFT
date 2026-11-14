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
            val inset = px(if (wide) 64 else 38)
            setPadding(inset, inset, inset, inset)
            append(horizontal().apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(label("SHIFT", 34, Font.Logo, SKY), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
                val state = if (parked) "정차 중" else "주차 확인 필요"
                addView(label("$employeeName  ·  $state", 26, Font.Medium, MUTED))
            })
            append(heading("오늘 방문 업무", 60), 18)
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
                append(label("시트, 목적지 변경, 메모와 로그아웃은 주차 후 이용할 수 있습니다.", 29, color = SKY), 34)
            }
        }
    }

    private fun nextVisit(visit: Visit, wide: Boolean) = with(design) {
        card(if (wide) 44 else 36, HYUNDAI).apply {
            append(label("다음 방문", 27, Font.Medium, SKY))
            if (visit.time.isNotBlank()) append(label(visit.time, if (wide) 58 else 50, Font.Logo), 14)
            append(heading(visit.title, if (wide) 46 else 42), 12)
            if (parked) {
                append(label(visit.address.ifBlank { "방문 주소 미정" }, 29, Font.Medium), 12)
                visit.evidence?.let { append(label(it, 27, Font.Medium, SKY), 12) }
                append(button(
                    if (visit.changedFrom != null) "변경 장소 · 내비로 보내기" else "목적지 확인",
                    primary = true,
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
                append(button("${visit.time}  ${visit.title}".trim(), primary = false) {
                    onAction(VehicleWorkAction.Destination(visit))
                }, 18)
            }
        }
    }

    private fun actionRow(actions: List<Triple<String, VehicleWorkAction, Boolean>>) = with(design) {
        horizontal().apply {
            for ((index, entry) in actions.withIndex()) {
                val (label, action, primary) = entry
                addView(button(label, primary) { onAction(action) }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply {
                    if (index > 0) marginStart = px(16)
                })
            }
        }
    }
}

internal enum class Font { Regular, Medium, Bold, Logo }

internal class ShiftVehicleDesign(private val context: Context, private val scale: Float) {
    fun vertical() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    fun horizontal() = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    fun card(padding: Int, color: Int = PANEL) = vertical().apply {
        val inset = px(padding)
        setPadding(inset, inset, inset, inset)
        background = rounded(color, 26, if (color == PANEL) LINE else Color.TRANSPARENT, if (color == PANEL) 2 else 0)
    }

    fun heading(copy: String, size: Int) = label(copy, size, Font.Bold).apply { isAccessibilityHeading = true }

    fun label(copy: String, size: Int, font: Font = Font.Regular, color: Int = TEXT) = TextView(context).apply {
        text = copy
        typeface = typeface(font)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size * scale)
        setTextColor(color)
        gravity = Gravity.CENTER_VERTICAL
        includeFontPadding = false
        val lineHeight = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP, ceil(size * 1.4f) * scale, resources.displayMetrics,
        ).roundToInt()
        setLineHeight(lineHeight)
        minHeight = lineHeight
    }

    fun button(copy: String, primary: Boolean, action: () -> Unit) = Button(context).apply {
        val color = if (primary) SKY else BACKGROUND
        text = copy
        typeface = typeface(Font.Bold)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 29 * scale)
        setTextColor(if (primary) BACKGROUND else SKY)
        isAllCaps = false
        includeFontPadding = false
        minimumWidth = 0
        minWidth = 0
        minimumHeight = maxOf(px(76), (48f * context.resources.displayMetrics.density).roundToInt())
        minHeight = minimumHeight
        setPadding(px(22), px(16), px(22), px(16))
        backgroundTintList = null
        stateListAnimator = null
        val states = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), rounded(color, 18, TEXT, 4))
            addState(intArrayOf(), rounded(color, 18, LINE, if (primary) 0 else 2))
        }
        background = RippleDrawable(ColorStateList.valueOf(0x406482AA), states, rounded(Color.WHITE, 18))
        setOnClickListener { action() }
    }

    fun LinearLayout.append(child: View, top: Int = 0, width: Int = MATCH_PARENT) {
        addView(child, LinearLayout.LayoutParams(width, WRAP_CONTENT).apply { topMargin = px(top) })
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

    fun typeface(font: Font): Typeface {
        return synchronized(faces) {
            faces.getOrPut(font) {
                val weight = when (font) {
                    Font.Regular -> 400
                    Font.Medium -> 500
                    Font.Bold, Font.Logo -> 700
                }
                val asset = if (font == Font.Logo) "asta_sans.ttf" else "noto_sans_kr.ttf"
                Typeface.Builder(context.assets, "fonts/$asset")
                    .setFontVariationSettings("'wght' $weight")
                    .setWeight(weight)
                    .build() ?: Typeface.create(Typeface.DEFAULT, weight, false)
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
        val MUTED = Color.rgb(175, 192, 213)
        val LINE = Color.rgb(43, 69, 98)
    }
}
