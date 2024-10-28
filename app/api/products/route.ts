'use server';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortOption = searchParams.get('sort') || 'default';
    
    let query = 'SELECT id, title, tags, link, image_data FROM products';
    
    if (sortOption === 'video') {
      query += ' ORDER BY tags';
    }
    
    const { rows } = await pool.query(query);
    
    const products = rows.map(product => {
      const allTags = product.tags.split(',').map((tag: string) => tag.trim());
      return {
        ...product,
        image_data: product.image_data ? product.image_data.toString('base64') : null,
        tags: allTags,
        groupTags: allTags.slice(0, -1)
      };
    });

    if (sortOption === 'video') {
      const groupedProducts: { [key: string]: any[] } = {};
      products.forEach(product => {
        product.groupTags.forEach((tag: string) => {
          if (!groupedProducts[tag]) {
            groupedProducts[tag] = [];
          }
          groupedProducts[tag].push(product);
        });
      });
      return NextResponse.json({ groupedProducts, sortOption });
    } else {
      return NextResponse.json({ products, sortOption });
    }
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
