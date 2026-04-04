use std::{
    fs::File,
    io::{BufWriter, Write},
    path::Path,
};

use crate::{mesh::Mesh, types::LithoError};

pub fn write_binary_stl(mesh: &Mesh, output_path: &Path, label: &str) -> Result<(), LithoError> {
    let file = File::create(output_path)?;
    let mut writer = BufWriter::new(file);
    let mut header = [0u8; 80];
    let label_bytes = label.as_bytes();
    let copy_length = label_bytes.len().min(header.len());
    header[..copy_length].copy_from_slice(&label_bytes[..copy_length]);

    writer.write_all(&header)?;
    writer.write_all(&(mesh.indices.len() as u32).to_le_bytes())?;

    for triangle in &mesh.indices {
        let a = mesh.vertices[triangle[0] as usize];
        let b = mesh.vertices[triangle[1] as usize];
        let c = mesh.vertices[triangle[2] as usize];
        let normal = triangle_normal(a, b, c);

        for value in normal {
            writer.write_all(&value.to_le_bytes())?;
        }

        for vertex in [a, b, c] {
            for value in vertex {
                writer.write_all(&value.to_le_bytes())?;
            }
        }

        writer.write_all(&0u16.to_le_bytes())?;
    }

    writer.flush()?;
    Ok(())
}

fn triangle_normal(a: [f32; 3], b: [f32; 3], c: [f32; 3]) -> [f32; 3] {
    let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    let length = (normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]).sqrt();

    if length <= f32::EPSILON {
        [0.0, 0.0, 0.0]
    } else {
        [normal[0] / length, normal[1] / length, normal[2] / length]
    }
}
