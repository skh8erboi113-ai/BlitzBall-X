class_name TechniqueWheel
extends Control

signal technique_selected(tech_name: String)
signal cancelled

@onready var container: VBoxContainer = $Panel/VBoxContainer
@onready var hp_label: Label = $Panel/CurrentHPLabel

var current_player: BlitzballPlayer = null

func _ready() -> void:
	visible = false

func open_for_player(player: BlitzballPlayer) -> void:
	current_player = player
	visible = true

	# Clear previous options
	for child in container.get_children():
		child.queue_free()

	if not player or not player.player_data:
		return

	if hp_label:
		hp_label.text = "HP: %d / %d" % [int(player.player_data.current_hp), int(player.player_data.max_hp)]

	var techs: Array[String] = player.player_data.learned_techniques
	if techs.is_empty():
		var empty_lbl := Label.new()
		empty_lbl.text = "No Special Techniques"
		empty_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		container.add_child(empty_lbl)
	else:
		for t_name in techs:
			var btn := Button.new()
			btn.text = t_name
			btn.custom_minimum_size = Vector2(240, 44)
			btn.pressed.connect(func(): _on_select(t_name))
			container.add_child(btn)

	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.custom_minimum_size = Vector2(240, 36)
	cancel_btn.pressed.connect(_on_cancel)
	container.add_child(cancel_btn)

func _on_select(tech_name: String) -> void:
	visible = false
	technique_selected.emit(tech_name)

func _on_cancel() -> void:
	visible = false
	cancelled.emit()
