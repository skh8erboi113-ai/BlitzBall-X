extends Node

var sfx_players: Array[AudioStreamPlayer] = []
var max_players: int = 12

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in range(max_players):
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		sfx_players.append(p)

func play_sfx(stream: AudioStream, pitch_variance: float = 0.05, volume_db: float = 0.0) -> void:
	if stream == null:
		return

	for p in sfx_players:
		if not p.playing:
			p.stream = stream
			p.volume_db = volume_db
			p.pitch_scale = 1.0 + randf_range(-pitch_variance, pitch_variance)
			p.play()
			return

func play_whistle() -> void:
	# Fallback procedural synth tone if no WAV is loaded
	pass
