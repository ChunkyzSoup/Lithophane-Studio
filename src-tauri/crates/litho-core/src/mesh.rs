use crate::{heightmap::HeightmapData, types::FlatLithophaneSettings};

pub struct Mesh {
    pub vertices: Vec<[f32; 3]>,
    pub indices: Vec<[u32; 3]>,
}

pub fn build_flat_mesh(heightmap: &HeightmapData, settings: &FlatLithophaneSettings) -> Mesh {
    let columns = heightmap.columns;
    let rows = heightmap.rows;
    let front_vertex_count = columns * rows;
    let width_step = settings.width_mm / (columns.saturating_sub(1) as f32);
    let height_step = settings.height_mm / (rows.saturating_sub(1) as f32);

    let mut vertices = Vec::with_capacity(front_vertex_count * 2);

    for row in 0..rows {
        let y = settings.height_mm / 2.0 - row as f32 * height_step;

        for column in 0..columns {
            let x = column as f32 * width_step - settings.width_mm / 2.0;
            let thickness = heightmap.thicknesses[row * columns + column];
            vertices.push([x, y, thickness]);
        }
    }

    for row in 0..rows {
        let y = settings.height_mm / 2.0 - row as f32 * height_step;

        for column in 0..columns {
            let x = column as f32 * width_step - settings.width_mm / 2.0;
            vertices.push([x, y, 0.0]);
        }
    }

    let mut indices = Vec::new();

    for row in 0..rows - 1 {
        for column in 0..columns - 1 {
            let front_a = vertex_index(column, row, columns);
            let front_b = vertex_index(column + 1, row, columns);
            let front_c = vertex_index(column, row + 1, columns);
            let front_d = vertex_index(column + 1, row + 1, columns);

            indices.push([front_a as u32, front_c as u32, front_b as u32]);
            indices.push([front_b as u32, front_c as u32, front_d as u32]);

            let back_a = front_vertex_count + front_a;
            let back_b = front_vertex_count + front_b;
            let back_c = front_vertex_count + front_c;
            let back_d = front_vertex_count + front_d;

            indices.push([back_a as u32, back_b as u32, back_c as u32]);
            indices.push([back_b as u32, back_d as u32, back_c as u32]);
        }
    }

    for row in 0..rows - 1 {
        let top_front = vertex_index(0, row, columns);
        let bottom_front = vertex_index(0, row + 1, columns);
        let top_back = front_vertex_count + top_front;
        let bottom_back = front_vertex_count + bottom_front;
        push_quad(
            &mut indices,
            top_back,
            top_front,
            bottom_back,
            bottom_front,
        );
    }

    for row in 0..rows - 1 {
        let top_front = vertex_index(columns - 1, row, columns);
        let bottom_front = vertex_index(columns - 1, row + 1, columns);
        let top_back = front_vertex_count + top_front;
        let bottom_back = front_vertex_count + bottom_front;
        push_quad(
            &mut indices,
            top_front,
            top_back,
            bottom_front,
            bottom_back,
        );
    }

    for column in 0..columns - 1 {
        let left_front = vertex_index(column, 0, columns);
        let right_front = vertex_index(column + 1, 0, columns);
        let left_back = front_vertex_count + left_front;
        let right_back = front_vertex_count + right_front;
        push_quad(
            &mut indices,
            left_front,
            left_back,
            right_front,
            right_back,
        );
    }

    for column in 0..columns - 1 {
        let left_front = vertex_index(column, rows - 1, columns);
        let right_front = vertex_index(column + 1, rows - 1, columns);
        let left_back = front_vertex_count + left_front;
        let right_back = front_vertex_count + right_front;
        push_quad(
            &mut indices,
            left_back,
            left_front,
            right_back,
            right_front,
        );
    }

    Mesh { vertices, indices }
}

fn vertex_index(column: usize, row: usize, columns: usize) -> usize {
    row * columns + column
}

fn push_quad(indices: &mut Vec<[u32; 3]>, a: usize, b: usize, c: usize, d: usize) {
    indices.push([a as u32, b as u32, c as u32]);
    indices.push([b as u32, d as u32, c as u32]);
}
