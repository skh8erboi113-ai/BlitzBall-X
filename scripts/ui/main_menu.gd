class_name MainMenu
extends Control

@onready var play_now_btn: Button = $VBoxContainer/PlayNowButton
@onready var season_btn: Button = $VBoxContainer/SeasonButton
@onready var quit_btn: Button = $VBoxContainer/QuitButton

func _ready() -> void:
	play_now_btn.pressed.connect(_on_play_now_pressed)
	season_btn.pressed.connect(_on_season_pressed)
	quit_btn.pressed.connect(_on_quit_pressed)

func _on_play_now_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/TeamSelect.tscn")

func _on_season_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/TeamSelect.tscn")

func _on_quit_pressed() -> void:
	get_tree().quit()
