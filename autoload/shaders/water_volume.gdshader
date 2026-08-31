shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_front, unshaded;

uniform vec4 water_color : source_color = vec4(0.0, 0.35, 0.7, 0.25);
uniform vec4 deep_color : source_color = vec4(0.0, 0.1, 0.3, 0.6);
uniform float caustic_scale : hint_range(1.0, 20.0) = 8.0;
uniform float caustic_speed : hint_range(0.0, 2.0) = 0.5;

void fragment() {
    float fresnel = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
    vec2 p = UV * caustic_scale;
    float t = TIME * caustic_speed;
    float c = sin(p.x * 3.0 + t) * sin(p.y * 3.7 - t * 0.7);
    c += sin(p.x * 2.3 - t * 1.3) * sin(p.y * 2.1 + t * 0.9);
    c = smoothstep(0.0, 0.6, (c / 2.0) * 0.5 + 0.5);

    vec3 final_color = mix(water_color.rgb, deep_color.rgb, 1.0 - fresnel) + vec3(c * 0.2);
    ALBEDO = final_color;
    ALPHA = mix(water_color.a * 0.5, water_color.a * 1.5, fresnel);
}
