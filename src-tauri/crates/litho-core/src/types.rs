use serde::{Deserialize, Serialize};

use crate::presets::CENTAURI_CARBON_BUILD_LIMIT_MM;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MeshDensity {
    Draft,
    Balanced,
    Fine,
}

impl MeshDensity {
    pub fn samples_per_mm(self) -> f32 {
        match self {
            Self::Draft => 2.0,
            Self::Balanced => 3.5,
            Self::Fine => 5.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlatLithophaneSettings {
    pub width_mm: f32,
    pub height_mm: f32,
    pub aspect_lock: bool,
    pub min_thickness_mm: f32,
    pub max_thickness_mm: f32,
    pub invert: bool,
    pub smoothing: u8,
    pub mesh_density: MeshDensity,
}

impl FlatLithophaneSettings {
    pub fn validate(&self) -> Result<(), LithoError> {
        if !self.width_mm.is_finite()
            || !self.height_mm.is_finite()
            || !self.min_thickness_mm.is_finite()
            || !self.max_thickness_mm.is_finite()
        {
            return Err(LithoError::Validation(
                "One or more numeric settings were invalid.".to_string(),
            ));
        }

        if !(20.0..=CENTAURI_CARBON_BUILD_LIMIT_MM).contains(&self.width_mm) {
            return Err(LithoError::Validation(format!(
                "Width must stay between 20 mm and {:.0} mm for the verified Centauri Carbon preset.",
                CENTAURI_CARBON_BUILD_LIMIT_MM
            )));
        }

        if !(20.0..=CENTAURI_CARBON_BUILD_LIMIT_MM).contains(&self.height_mm) {
            return Err(LithoError::Validation(format!(
                "Height must stay between 20 mm and {:.0} mm for the verified Centauri Carbon preset.",
                CENTAURI_CARBON_BUILD_LIMIT_MM
            )));
        }

        if self.min_thickness_mm <= 0.0 {
            return Err(LithoError::Validation(
                "Minimum thickness must be greater than zero.".to_string(),
            ));
        }

        if self.max_thickness_mm <= self.min_thickness_mm {
            return Err(LithoError::Validation(
                "Maximum thickness must be greater than minimum thickness.".to_string(),
            ));
        }

        if self.smoothing > 100 {
            return Err(LithoError::Validation(
                "Surface cleanup must stay between 0 and 100 percent.".to_string(),
            ));
        }

        Ok(())
    }

    pub fn target_columns(&self) -> usize {
        ((self.width_mm * self.mesh_density.samples_per_mm()).round() as usize).max(40) + 1
    }

    pub fn target_rows(&self) -> usize {
        ((self.height_mm * self.mesh_density.samples_per_mm()).round() as usize).max(40) + 1
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewArtifacts {
    pub grayscale_png: Vec<u8>,
    pub depth_png: Vec<u8>,
    pub source_width_px: u32,
    pub source_height_px: u32,
    pub mesh_columns: u32,
    pub mesh_rows: u32,
    pub estimated_triangles: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSummary {
    pub output_path: String,
    pub mesh_columns: u32,
    pub mesh_rows: u32,
    pub triangle_count: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum LithoError {
    #[error("The image file could not be decoded: {0}")]
    ImageDecode(#[from] image::ImageError),
    #[error("Preview image encoding failed: {0}")]
    ImageEncode(image::ImageError),
    #[error("File write failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Validation(String),
}
