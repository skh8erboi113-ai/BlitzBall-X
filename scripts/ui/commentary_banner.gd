class_name CommentaryBanner
extends Control

@onready var banner_label: Label = $BannerPanel/BannerLabel
@onready var panel: Panel = $BannerPanel

func _ready() -> void:
	modulate.a = 0.0

func announce(text: String, duration: float = 2.5) -> void:
	banner_label.text = text
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.25)
	tween.tween_interval(duration)
	tween.tween_property(self, "modulate:a", 0.0, 0.35)
