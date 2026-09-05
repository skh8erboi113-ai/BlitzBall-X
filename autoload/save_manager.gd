extends Node

const SAVE_FILE_PATH: String = "user://blitzball_save.json"

func save_game(season_data: Dictionary, franchise_data: Dictionary) -> bool:
	var s_mgr = get_node_or_null("/root/SettingsManager")
	var save_payload := {
		"version": 1.0,
		"timestamp": Time.get_unix_time_from_system(),
		"season": season_data,
		"franchise": franchise_data,
		"settings": {
			"quality": s_mgr.quality_preset if s_mgr else "medium",
			"target_fps": s_mgr.target_fps if s_mgr else 60,
			"fullscreen": s_mgr.is_fullscreen if s_mgr else false,
			"volume": s_mgr.master_volume if s_mgr else 1.0
		}
	}

	var file := FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	if not file:
		return false

	var json_str := JSON.stringify(save_payload, "\t")
	file.store_string(json_str)
	file.close()
	return true

func load_game() -> Dictionary:
	if not FileAccess.file_exists(SAVE_FILE_PATH):
		return {}

	var file := FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if not file:
		return {}

	var content := file.get_as_text()
	file.close()

	var parsed: Variant = JSON.parse_string(content)
	if parsed is Dictionary:
		return parsed
	return {}

func has_save_file() -> bool:
	return FileAccess.file_exists(SAVE_FILE_PATH)
