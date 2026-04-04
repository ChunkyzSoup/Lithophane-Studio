use crate::{
    image_pipeline::PreparedImage,
    types::{FlatLithophaneSettings, LithoError},
};

pub struct HeightmapData {
    pub source_width_px: u32,
    pub source_height_px: u32,
    pub columns: usize,
    pub rows: usize,
    pub grayscale: Vec<f32>,
    pub thicknesses: Vec<f32>,
    min_thickness_mm: f32,
    max_thickness_mm: f32,
}

impl HeightmapData {
    pub fn normalized_depth(&self) -> Vec<f32> {
        let range = (self.max_thickness_mm - self.min_thickness_mm).max(f32::EPSILON);

        self.thicknesses
            .iter()
            .map(|thickness| (thickness - self.min_thickness_mm) / range)
            .collect()
    }

    pub fn estimated_triangles(&self) -> u32 {
        let front_and_back = 4 * (self.columns.saturating_sub(1)) * (self.rows.saturating_sub(1));
        let side_walls = 4 * (self.columns + self.rows - 2);
        (front_and_back + side_walls) as u32
    }
}

pub fn build_heightmap(
    prepared: PreparedImage,
    settings: &FlatLithophaneSettings,
) -> Result<HeightmapData, LithoError> {
    let grayscale = smooth_field(
        &prepared.grayscale,
        prepared.columns,
        prepared.rows,
        smoothing_passes(settings.smoothing),
    );
    let thickness_range = settings.max_thickness_mm - settings.min_thickness_mm;
    let thicknesses = grayscale
        .iter()
        .map(|luminance| {
            let mapped = if settings.invert {
                *luminance
            } else {
                1.0 - *luminance
            };

            settings.min_thickness_mm + mapped * thickness_range
        })
        .collect();

    Ok(HeightmapData {
        source_width_px: prepared.source_width_px,
        source_height_px: prepared.source_height_px,
        columns: prepared.columns,
        rows: prepared.rows,
        grayscale,
        thicknesses,
        min_thickness_mm: settings.min_thickness_mm,
        max_thickness_mm: settings.max_thickness_mm,
    })
}

fn smoothing_passes(smoothing: u8) -> u8 {
    match smoothing {
        0 => 0,
        1..=24 => 1,
        25..=59 => 2,
        _ => 3,
    }
}

fn smooth_field(values: &[f32], columns: usize, rows: usize, passes: u8) -> Vec<f32> {
    let mut current = values.to_vec();

    for _ in 0..passes {
        let mut next = vec![0.0; current.len()];

        for row in 0..rows {
            for column in 0..columns {
                let mut sum = 0.0;
                let mut count = 0.0;

                for row_offset in -1..=1 {
                    let next_row = row as isize + row_offset;

                    if !(0..rows as isize).contains(&next_row) {
                        continue;
                    }

                    for column_offset in -1..=1 {
                        let next_column = column as isize + column_offset;

                        if !(0..columns as isize).contains(&next_column) {
                            continue;
                        }

                        let index = next_row as usize * columns + next_column as usize;
                        sum += current[index];
                        count += 1.0;
                    }
                }

                next[row * columns + column] = sum / count;
            }
        }

        current = next;
    }

    current
}
