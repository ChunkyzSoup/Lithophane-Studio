use std::io::Cursor;

use image::{
    imageops::FilterType, DynamicImage, GrayImage, ImageFormat, Luma,
};

use crate::types::LithoError;

pub struct PreparedImage {
    pub source_width_px: u32,
    pub source_height_px: u32,
    pub columns: usize,
    pub rows: usize,
    pub grayscale: Vec<f32>,
}

pub fn decode_and_resize(
    image_bytes: &[u8],
    columns: usize,
    rows: usize,
) -> Result<PreparedImage, LithoError> {
    let decoded = image::load_from_memory(image_bytes)?;
    let source_width_px = decoded.width();
    let source_height_px = decoded.height();
    let grayscale_image = decoded.to_luma8();
    let resized = DynamicImage::ImageLuma8(grayscale_image)
        .resize_exact(columns as u32, rows as u32, FilterType::Triangle)
        .to_luma8();
    let grayscale = resized
        .pixels()
        .map(|pixel| f32::from(pixel[0]) / 255.0)
        .collect();

    Ok(PreparedImage {
        source_width_px,
        source_height_px,
        columns,
        rows,
        grayscale,
    })
}

pub fn encode_scalar_png(
    values: &[f32],
    columns: usize,
    rows: usize,
) -> Result<Vec<u8>, LithoError> {
    let mut image = GrayImage::new(columns as u32, rows as u32);

    for row in 0..rows {
        for column in 0..columns {
            let index = row * columns + column;
            let value = (values[index].clamp(0.0, 1.0) * 255.0).round() as u8;
            image.put_pixel(column as u32, row as u32, Luma([value]));
        }
    }

    let mut cursor = Cursor::new(Vec::new());
    DynamicImage::ImageLuma8(image)
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(LithoError::ImageEncode)?;

    Ok(cursor.into_inner())
}
