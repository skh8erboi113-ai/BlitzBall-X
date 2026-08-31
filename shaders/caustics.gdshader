shader_type spatial;
render_mode blend_add, unshaded, cull_disabled;

uniform float scale : hint_range(1.0, 30.0) = 12.0;
uniform float speed : hint_range(0.0, 3.0) = 0.8;
uniform float brightness : hint_range(0.0, 2.0) = 0.6;
uniform vec4 caustic_color : source_color = vec4(0.2, 0.6, 1.0, 1.0);

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float voronoi(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);
    float min_dist = 1.0;

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + 100.0));
            point = 0.5 + 0.5 * sin(TIME * speed + 6.2831 * point);
            float dist = length(neighbor + point - f);
            min_dist = min(min_dist, dist);
        }
    }
    return min_dist;
}

void fragment() {
    vec2 uv = UV * scale;
    float v1 = voronoi(uv);
    float v2 = voronoi(uv * 1.5 + 10.0);
    float caustic = smoothstep(0.0, 0.15, v1) * smoothstep(0.0, 0.15, v2);
    caustic = pow(caustic, 0.8) * brightness;

    ALBEDO = caustic_color.rgb * caustic;
    ALPHA = caustic;
}
