class_name MatchHUD
extends CanvasLayer

@onready var score_label: Label = $TopBar/ScoreLabel if has_node("TopBar/ScoreLabel") else null
@onready var timer_label: Label = $TopBar/TimerLabel if has_node("TopBar/TimerLabel") else null
@onready var stamina_bar: ProgressBar = $BottomBar/StaminaBar if has_node("BottomBar/StaminaBar") else null
@onready var player_name: Label = $BottomBar/PlayerName if has_node("BottomBar/PlayerName") else null

var match_mgr: MatchManager = null

func _ready() -> void:
	match_mgr = get_parent() as MatchManager

func _process(_delta: float) -> void:
	if not match_mgr:
		return

	if score_label:
		score_label.text = "%d  -  %d" % [match_mgr.home_score, match_mgr.away_score]

	if timer_label:
		var time_left: float = maxf(match_mgr.half_duration - match_mgr.match_timer, 0.0)
		var mins := int(time_left) / 60
		var secs := int(time_left) % 60
		timer_label.text = "%02d:%02d" % [mins, secs]

	if match_mgr.user_player and match_mgr.user_player.player_data:
		var pdata := match_mgr.user_player.player_data
		if player_name:
			player_name.text = pdata.get_full_name()
		if stamina_bar:
			stamina_bar.value = (pdata.current_hp / pdata.max_hp) * 100.0
