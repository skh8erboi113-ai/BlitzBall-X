extends Node

const SAVE_FILE_PATH: String = "user://blitzball_save.json"

func save_game(season_data: Dictionary, franchise_data: Dictionary) -> bool:
	var save_payload := {
		"version": 1.0,
		"timestamp": Time.get_unix_time_from_system(),
		"season": season_data,
		"franchise": franchise_data,
		"settings": {
			"quality": SettingsManager.quality_preset,
			"target_fps": SettingsManager.target_fps,
			"fullscreen": SettingsManager.is_fullscreen,
			"volume": SettingsManager.master_volume
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
