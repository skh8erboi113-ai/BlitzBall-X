shader_type spatial;
render_mode blend_add, cull_disabled, unshaded;

uniform vec4 core_color : source_color = vec4(0.3, 0.8, 1.0, 1.0);
uniform vec4 edge_color : source_color = vec4(0.0, 0.2, 0.8, 0.0);
uniform float speed : hint_range(0.1, 10.0) = 3.0;

void fragment() {
    float gradient = UV.x;
    float pulse = sin(TIME * speed + UV.y * 6.28) * 0.15 + 0.85;
    vec3 col = mix(edge_color.rgb, core_color.rgb, gradient * pulse);
    float alpha = gradient * (1.0 - abs(UV.y - 0.5) * 2.0);
    ALBEDO = col;
    ALPHA = clamp(alpha, 0.0, 1.0);
}
