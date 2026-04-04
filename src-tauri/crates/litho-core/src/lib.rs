mod export;
mod heightmap;
mod image_pipeline;
mod mesh;
pub mod presets;
pub mod types;

use std::path::Path;

use export::write_binary_stl;
use heightmap::build_heightmap;
use image_pipeline::{decode_and_resize, encode_scalar_png};
use mesh::build_flat_mesh;
use types::{ExportSummary, FlatLithophaneSettings, LithoError, PreviewArtifacts};

pub fn preview_flat_panel(
    image_bytes: &[u8],
    settings: &FlatLithophaneSettings,
) -> Result<PreviewArtifacts, LithoError> {
    if image_bytes.is_empty() {
        return Err(LithoError::Validation(
            "The selected image was empty.".to_string(),
        ));
    }

    settings.validate()?;

    let prepared = decode_and_resize(image_bytes, settings.target_columns(), settings.target_rows())?;
    let heightmap = build_heightmap(prepared, settings)?;
    let grayscale_png = encode_scalar_png(&heightmap.grayscale, heightmap.columns, heightmap.rows)?;
    let depth_png = encode_scalar_png(
        &heightmap.normalized_depth(),
        heightmap.columns,
        heightmap.rows,
    )?;

    Ok(PreviewArtifacts {
        grayscale_png,
        depth_png,
        source_width_px: heightmap.source_width_px,
        source_height_px: heightmap.source_height_px,
        mesh_columns: heightmap.columns as u32,
        mesh_rows: heightmap.rows as u32,
        estimated_triangles: heightmap.estimated_triangles(),
    })
}

pub fn export_flat_panel_to_stl(
    image_bytes: &[u8],
    settings: &FlatLithophaneSettings,
    output_path: &Path,
) -> Result<ExportSummary, LithoError> {
    if image_bytes.is_empty() {
        return Err(LithoError::Validation(
            "The selected image was empty.".to_string(),
        ));
    }

    settings.validate()?;

    let prepared = decode_and_resize(image_bytes, settings.target_columns(), settings.target_rows())?;
    let heightmap = build_heightmap(prepared, settings)?;
    let mesh = build_flat_mesh(&heightmap, settings);
    write_binary_stl(&mesh, output_path, "Lithophane Studio flat panel")?;

    Ok(ExportSummary {
        output_path: output_path.display().to_string(),
        mesh_columns: heightmap.columns as u32,
        mesh_rows: heightmap.rows as u32,
        triangle_count: mesh.indices.len() as u32,
    })
}
