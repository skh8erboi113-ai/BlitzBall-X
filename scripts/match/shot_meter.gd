class_name ShotMeter
extends Control

signal shot_released(timing_quality: float, is_perfect_green: bool)

@onready var fill_bar: ProgressBar = $MeterContainer/FillBar
@onready var target_marker: ColorRect = $MeterContainer/TargetMarker
@onready var feedback_label: Label = $FeedbackLabel

var is_active: bool = false
var current_value: float = 0.0
var target_value: float = 0.80 # 80% is the ideal "Green" release zone
var green_window: float = 0.06 # ±0.06 is perfect green

func _ready() -> void:
	visible = false
	if feedback_label:
		feedback_label.text = ""

func start_meter() -> void:
	visible = true
	is_active = true
	current_value = 0.0
	fill_bar.value = 0.0
	feedback_label.text = ""
	# Slight variation in green zone per shot for variety
	target_value = randf_range(0.75, 0.85)

func _process(delta: float) -> void:
	if not is_active:
		return

	current_value += delta * 1.4
	fill_bar.value = current_value * 100.0

	# Highlight color as it approaches green release
	var diff: float = absf(current_value - target_value)
	if diff <= green_window:
		fill_bar.modulate = Color(0.1, 1.0, 0.2) # Green
	elif current_value > target_value + green_window:
		fill_bar.modulate = Color(1.0, 0.2, 0.2) # Red (Late)
	else:
		fill_bar.modulate = Color(1.0, 0.85, 0.1) # Yellow (Early)

	# Overfill limit
	if current_value >= 1.15:
		release_meter()

func release_meter() -> void:
	if not is_active:
		return

	is_active = false
	var diff: float = absf(current_value - target_value)
	var is_green: bool = diff <= green_window
	var timing_score: float = maxf(0.0, 1.0 - (diff * 2.5))

	if is_green:
		feedback_label.text = "PERFECT GREEN!"
		feedback_label.modulate = Color(0.1, 1.0, 0.3)
	elif current_value < target_value:
		feedback_label.text = "SLIGHTLY EARLY"
		feedback_label.modulate = Color(1.0, 0.85, 0.2)
	else:
		feedback_label.text = "LATE RELEASE"
		feedback_label.modulate = Color(1.0, 0.3, 0.2)

	shot_released.emit(timing_score, is_green)

	# Hide meter after display delay
	var t := create_tween()
	t.tween_interval(0.6)
	t.tween_property(self, "modulate:a", 0.0, 0.2)
	t.tween_callback(func():
		visible = false
		modulate.a = 1.0
	)
