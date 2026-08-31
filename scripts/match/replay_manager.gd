class_name ReplayManager
extends Node

signal replay_started
signal replay_finished

var is_replaying: bool = false
var camera: MatchCamera = null

func setup(cam: MatchCamera) -> void:
	camera = cam

func trigger_goal_replay(scorer: BlitzballPlayer, ball: BlitzballBall) -> void:
	if is_replaying:
		return
	is_replaying = true
	replay_started.emit()

	# Slow motion effect (NBA 2K style broadcast replay)
	Engine.time_scale = 0.35

	if camera and scorer:
		camera.target = scorer
		camera.switch_mode(MatchCamera.CameraMode.GOAL_REPLAY)

	# Run replay duration
	await get_tree().create_timer(1.2).timeout # In scaled time

	# Return to standard match playback
	Engine.time_scale = 1.0
	if camera:
		camera.switch_mode(MatchCamera.CameraMode.FOLLOW_PLAYER)

	is_replaying = false
	replay_finished.emit()
