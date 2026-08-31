class_name OptionsMenu
extends Control

@onready var quality_btn: OptionButton = $Panel/VBoxContainer/QualityOption
@onready var fps_btn: OptionButton = $Panel/VBoxContainer/FPSOption
@onready var fullscreen_check: CheckBox = $Panel/VBoxContainer/FullscreenCheck
@onready var master_slider: HSlider = $Panel/VBoxContainer/MasterVolSlider
@onready var back_btn: Button = $Panel/BackButton

func _ready() -> void:
	# Populate Graphic Presets
	quality_btn.clear()
	quality_btn.add_item("Low (FSR Performance)")
	quality_btn.add_item("Medium (Balanced 60FPS)")
	quality_btn.add_item("High (Ultra Fidelity)")
	quality_btn.select(1)

	# Populate FPS Caps
	fps_btn.clear()
	fps_btn.add_item("30 FPS")
	fps_btn.add_item("60 FPS")
	fps_btn.add_item("Unlimited")
	fps_btn.select(1)

	master_slider.value = SettingsManager.master_volume * 100.0
	fullscreen_check.button_pressed = SettingsManager.is_fullscreen

	quality_btn.item_selected.connect(_on_quality_changed)
	fps_btn.item_selected.connect(_on_fps_changed)
	fullscreen_check.toggled.connect(_on_fullscreen_toggled)
	master_slider.value_changed.connect(_on_volume_changed)
	back_btn.pressed.connect(_on_back)

func _on_quality_changed(idx: int) -> void:
	var presets := ["low", "medium", "high"]
	SettingsManager.set_quality_preset(presets[idx])

func _on_fps_changed(idx: int) -> void:
	var caps := [30, 60, 0]
	SettingsManager.target_fps = caps[idx]
	Engine.max_fps = caps[idx]

func _on_fullscreen_toggled(pressed: bool) -> void:
	SettingsManager.toggle_fullscreen(pressed)

func _on_volume_changed(val: float) -> void:
	SettingsManager.set_master_volume(val / 100.0)

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/MainMenu.tscn")
