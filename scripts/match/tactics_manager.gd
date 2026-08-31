class_name TacticsManager
extends Node

signal tactic_changed(new_tactic_name: String)

enum Strategy {
	NORMAL,         # Standard balanced positioning
	ALL_OUT_ATTACK, # Forwards push deep into opponent territory
	HIGH_PRESS,     # Midfielders aggressively challenge ball carrier
	COUNTER_ATTACK, # Defenders stay deep; forwards sprint on turnover
	PARK_THE_SPHERE # All outfield players drop near own goal
}

var current_strategy: Strategy = Strategy.NORMAL

func set_strategy(strat: Strategy) -> void:
	current_strategy = strat
	var strat_name := Strategy.keys()[strat].capitalize()
	tactic_changed.emit(strat_name)

func get_formation_offset(pos_type: BlitzballPlayerData.Position, is_home: bool) -> Vector3:
	var sign_m: float = -1.0 if is_home else 1.0
	var offset := Vector3.ZERO

	match current_strategy:
		Strategy.ALL_OUT_ATTACK:
			if pos_type in [BlitzballPlayerData.Position.LEFT_FORWARD, BlitzballPlayerData.Position.RIGHT_FORWARD, BlitzballPlayerData.Position.MIDFIELDER]:
				offset.x = sign_m * -6.0
		Strategy.HIGH_PRESS:
			if pos_type == BlitzballPlayerData.Position.MIDFIELDER:
				offset.x = sign_m * -4.0
		Strategy.PARK_THE_SPHERE:
			offset.x = sign_m * 6.0
		Strategy.COUNTER_ATTACK:
			if pos_type in [BlitzballPlayerData.Position.LEFT_DEFENDER, BlitzballPlayerData.Position.RIGHT_DEFENDER]:
				offset.x = sign_m * 4.0
		Strategy.NORMAL:
			offset = Vector3.ZERO

	return offset
