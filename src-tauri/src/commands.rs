use std::path::Path;

use litho_core::{
    export_flat_panel_to_stl,
    preview_flat_panel,
    types::{ExportSummary, FlatLithophaneSettings, PreviewArtifacts},
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewFlatRequest {
    pub image_bytes: Vec<u8>,
    pub settings: FlatLithophaneSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFlatRequest {
    pub image_bytes: Vec<u8>,
    pub settings: FlatLithophaneSettings,
    pub output_path: String,
}

#[tauri::command]
pub fn preview_flat_lithophane(request: PreviewFlatRequest) -> Result<PreviewArtifacts, String> {
    eprintln!(
        "[lithophane:backend] preview_flat_lithophane start bytes={} smoothing={} density={:?}",
        request.image_bytes.len(),
        request.settings.smoothing,
        request.settings.mesh_density
    );

    match preview_flat_panel(&request.image_bytes, &request.settings) {
        Ok(preview) => {
            eprintln!(
                "[lithophane:backend] preview_flat_lithophane done mesh={}x{} triangles={}",
                preview.mesh_columns, preview.mesh_rows, preview.estimated_triangles
            );
            Ok(preview)
        }
        Err(error) => {
            eprintln!(
                "[lithophane:backend] preview_flat_lithophane failed error={}",
                error
            );
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub fn export_flat_lithophane_stl(request: ExportFlatRequest) -> Result<ExportSummary, String> {
    eprintln!(
        "[lithophane:backend] export_flat_lithophane_stl start bytes={} output={}",
        request.image_bytes.len(),
        request.output_path
    );

    match export_flat_panel_to_stl(
        &request.image_bytes,
        &request.settings,
        Path::new(&request.output_path),
    ) {
        Ok(summary) => {
            eprintln!(
                "[lithophane:backend] export_flat_lithophane_stl done mesh={}x{} triangles={}",
                summary.mesh_columns, summary.mesh_rows, summary.triangle_count
            );
            Ok(summary)
        }
        Err(error) => {
            eprintln!(
                "[lithophane:backend] export_flat_lithophane_stl failed error={}",
                error
            );
            Err(error.to_string())
        }
    }
}
