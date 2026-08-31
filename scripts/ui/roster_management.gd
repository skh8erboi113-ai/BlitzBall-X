class_name RosterManagement
extends Control

@onready var roster_list: ItemList = $MainPanel/RosterList
@onready var player_details: RichTextLabel = $MainPanel/PlayerDetails
@onready var back_btn: Button = $TopBar/BackButton

var current_team: BlitzballTeamData = null

func _ready() -> void:
	back_btn.pressed.connect(_on_back)
	roster_list.item_selected.connect(_on_player_selected)

	# Load active player team
	current_team = TeamDatabase.teams.get(GameManager.current_home_team_id)
	_populate_roster()

func _populate_roster() -> void:
	roster_list.clear()
	if not current_team:
		return

	for p in current_team.roster:
		var pos_str := BlitzballPlayerData.Position.keys()[p.position]
		var item_text := "%-4s | %-16s | OVR: %2d | SPD: %2d | SHT: %2d | TCK: %2d" % [
			pos_str.substr(0, 2), p.get_full_name(), p.get_overall_rating(), p.speed, p.shooting, p.tackling
		]
		roster_list.add_item(item_text)

	if current_team.roster.size() > 0:
		roster_list.select(0)
		_on_player_selected(0)

func _on_player_selected(index: int) -> void:
	if index < 0 or index >= current_team.roster.size():
		return

	var p: BlitzballPlayerData = current_team.roster[index]
	var text := "[b][font_size=24]%s[/font_size][/b]\n" % p.get_full_name()
	text += "Position: [color=yellow]%s[/color] | Age: %d | OVR: [color=green]%d[/color]\n\n" % [
		BlitzballPlayerData.Position.keys()[p.position], p.age, p.get_overall_rating()
	]
	text += "[b]OFFENSE[/b]\n"
	text += "Shooting: %d | Passing: %d | Dribbling: %d | Finishing: %d\n\n" % [p.shooting, p.passing, p.dribbling, p.finishing]
	text += "[b]DEFENSE & GOALKEEPING[/b]\n"
	text += "Tackling: %d | Blocking: %d | Reflexes: %d | Reach: %d\n\n" % [p.tackling, p.blocking, p.reflexes, p.reach]
	text += "[b]PHYSICAL[/b]\n"
	text += "Speed: %d | Acceleration: %d | Endurance (HP): %d | Strength: %d\n\n" % [p.speed, p.acceleration, p.endurance, p.strength]
	text += "[b]TECHNIQUES[/b]\n"
	if p.learned_techniques.is_empty():
		text += "None\n"
	else:
		for tech in p.learned_techniques:
			text += "• %s  " % tech

	player_details.text = text

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/SeasonDashboard.tscn")
