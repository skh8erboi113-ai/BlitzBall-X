extends Node

var target_fps: int = 60
var is_fullscreen: bool = false
var master_volume: float = 1.0
var sfx_volume: float = 1.0
var music_volume: float = 0.8
var quality_preset: String = "medium"

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	apply_performance_defaults()

func apply_performance_defaults() -> void:
	Engine.max_fps = target_fps
	Engine.physics_ticks_per_second = target_fps
	set_quality_preset(quality_preset)

func set_quality_preset(preset: String) -> void:
	quality_preset = preset
	var vp := get_viewport()
	if not vp:
		return

	match preset:
		"low":
			vp.scaling_3d_scale = 0.65
			vp.msaa_3d = Viewport.MSAA_DISABLED
			RenderingServer.directional_shadow_atlas_set_size(1024, true)
		"medium":
			vp.scaling_3d_scale = 0.85
			vp.msaa_3d = Viewport.MSAA_2X
			RenderingServer.directional_shadow_atlas_set_size(2048, true)
		"high":
			vp.scaling_3d_scale = 1.0
			vp.msaa_3d = Viewport.MSAA_4X
			RenderingServer.directional_shadow_atlas_set_size(4096, true)

func toggle_fullscreen(enable: bool) -> void:
	is_fullscreen = enable
	if enable:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)

func set_master_volume(val: float) -> void:
	master_volume = clampf(val, 0.0, 1.0)
	var bus_idx := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_volume_db(bus_idx, linear_to_db(master_volume))
