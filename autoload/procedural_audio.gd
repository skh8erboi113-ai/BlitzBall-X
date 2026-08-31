extends Node

# Procedural sound generator - creates audio dynamically in memory!

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

func play_whistle() -> void:
	_play_tone(2400.0, 0.25, 0.4)

func play_kick() -> void:
	_play_noise(0.08, 0.6, 120.0)

func play_tackle_thud() -> void:
	_play_noise(0.18, 0.7, 80.0)

func play_goal_horn() -> void:
	_play_tone(440.0, 0.8, 0.5)

func _play_tone(freq: float, duration: float, vol: float) -> void:
	var sample_rate := 22050
	var total_frames := int(sample_rate * duration)
	var audio_stream := AudioStreamWAV.new()
	audio_stream.format = AudioStreamWAV.FORMAT_8_BITS
	audio_stream.mix_rate = sample_rate

	var data := PackedByteArray()
	data.resize(total_frames)

	for i in range(total_frames):
		var t: float = float(i) / float(sample_rate)
		var envelope: float = 1.0 - (float(i) / float(total_frames))
		var sample: float = sin(TAU * freq * t) * envelope * vol
		var byte_val: int = clampi(int((sample * 0.5 + 0.5) * 255.0), 0, 255)
		data[i] = byte_val

	audio_stream.data = data

	var p := AudioStreamPlayer.new()
	add_child(p)
	p.stream = audio_stream
	p.play()
	p.finished.connect(p.queue_free)

func _play_noise(duration: float, vol: float, _filter_freq: float) -> void:
	var sample_rate := 22050
	var total_frames := int(sample_rate * duration)
	var audio_stream := AudioStreamWAV.new()
	audio_stream.format = AudioStreamWAV.FORMAT_8_BITS
	audio_stream.mix_rate = sample_rate

	var data := PackedByteArray()
	data.resize(total_frames)

	for i in range(total_frames):
		var envelope: float = 1.0 - (float(i) / float(total_frames))
		var sample: float = (randf() * 2.0 - 1.0) * envelope * vol
		var byte_val: int = clampi(int((sample * 0.5 + 0.5) * 255.0), 0, 255)
		data[i] = byte_val

	audio_stream.data = data

	var p := AudioStreamPlayer.new()
	add_child(p)
	p.stream = audio_stream
	p.play()
	p.finished.connect(p.queue_free)
