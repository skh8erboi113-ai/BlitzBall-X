class_name TacticsMenu
extends Control

signal tactic_selected(strategy_idx: int)

@onready var panel: Panel = $Panel
var tactics_mgr: TacticsManager = null

func _ready() -> void:
	visible = false
	$Panel/VBoxContainer/NormalBtn.pressed.connect(func(): _select(TacticsManager.Strategy.NORMAL))
	$Panel/VBoxContainer/AttackBtn.pressed.connect(func(): _select(TacticsManager.Strategy.ALL_OUT_ATTACK))
	$Panel/VBoxContainer/PressBtn.pressed.connect(func(): _select(TacticsManager.Strategy.HIGH_PRESS))
	$Panel/VBoxContainer/CounterBtn.pressed.connect(func(): _select(TacticsManager.Strategy.COUNTER_ATTACK))
	$Panel/VBoxContainer/DefendBtn.pressed.connect(func(): _select(TacticsManager.Strategy.PARK_THE_SPHERE))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_focus_next"): # Tab / D-Pad quick toggle
		visible = not visible

func _select(strat: TacticsManager.Strategy) -> void:
	visible = false
	if tactics_mgr:
		tactics_mgr.set_strategy(strat)
	tactic_selected.emit(strat)
