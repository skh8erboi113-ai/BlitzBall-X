class_name FreeAgencyUI
extends Control

@onready var agent_list: ItemList = $MainPanel/AgentList
@onready var details_label: RichTextLabel = $MainPanel/DetailsLabel
@onready var sign_btn: Button = $MainPanel/SignButton
@onready var budget_label: Label = $TopBar/BudgetLabel
@onready var back_btn: Button = $TopBar/BackButton

var scouting_mgr: ScoutingManager = null
var current_team: BlitzballTeamData = null
var selected_agent: BlitzballPlayerData = null

func _ready() -> void:
	scouting_mgr = ScoutingManager.new()
	add_child(scouting_mgr)

	current_team = TeamDatabase.teams.get(GameManager.current_home_team_id)
	back_btn.pressed.connect(_on_back)
	sign_btn.pressed.connect(_on_sign_agent)
	agent_list.item_selected.connect(_on_agent_selected)

	_refresh_ui()

func _refresh_ui() -> void:
	if current_team:
		budget_label.text = "TEAM BUDGET: %d Gil" % current_team.budget

	agent_list.clear()
	for i in range(scouting_mgr.free_agents.size()):
		var a := scouting_mgr.free_agents[i]
		var pos_str := BlitzballPlayerData.Position.keys()[a.position].substr(0, 2)
		var item_str := "%-3s | %-16s | OVR: %2d | Cost: %4d Gil" % [
			pos_str, a.get_full_name(), a.get_overall_rating(), a.salary
		]
		agent_list.add_item(item_str)

	if scouting_mgr.free_agents.size() > 0:
		agent_list.select(0)
		_on_agent_selected(0)
	else:
		details_label.text = "No free agents available for scout."
		sign_btn.disabled = true

func _on_agent_selected(index: int) -> void:
	if index < 0 or index >= scouting_mgr.free_agents.size():
		return

	selected_agent = scouting_mgr.free_agents[index]
	var text := "[b][font_size=22]%s[/font_size][/b]\n" % selected_agent.get_full_name()
	text += "Position: %s | OVR: %d\n" % [BlitzballPlayerData.Position.keys()[selected_agent.position], selected_agent.get_overall_rating()]
	text += "Wage Requirement: [color=yellow]%d Gil[/color]\n\n" % selected_agent.salary
	text += "SPD: %d | SHT: %d | PAS: %d | TCK: %d | CAT: %d\n\n" % [
		selected_agent.speed, selected_agent.shooting, selected_agent.passing, selected_agent.tackling, selected_agent.reflexes
	]
	text += "[b]Techniques:[/b] %s" % (", ".join(selected_agent.learned_techniques) if not selected_agent.learned_techniques.is_empty() else "None")
	details_label.text = text

	sign_btn.disabled = (current_team.budget < selected_agent.salary)

func _on_sign_agent() -> void:
	if selected_agent and current_team:
		if scouting_mgr.sign_free_agent(current_team, selected_agent):
			_refresh_ui()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/SeasonDashboard.tscn")
