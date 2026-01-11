import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';

export const dynamic = 'force-dynamic';

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  problem: string;
  recommendation: string;
  expected_impact: string;
  action_items: string[];
  category: string;
}

interface PDFRequest {
  type: 'executive' | 'action-plan';
  recommendations: AIRecommendation[];
  executive_summary?: string;
  generated_at?: string;
}

// Helper to wrap text
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Helper to add text with automatic page breaks
function addText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  color: { red: number; green: number; blue: number },
  maxWidth: number
): { y: number; page: PDFPage } {
  const lines = wrapText(text, maxWidth, font, fontSize);
  let currentY = y;
  let currentPage = page;

  for (const line of lines) {
    if (currentY < 50) {
      // Need new page
      const pdfDoc = currentPage.doc;
      currentPage = pdfDoc.addPage([612, 792]);
      currentY = 750;
    }

    currentPage.drawText(line, {
      x,
      y: currentY,
      size: fontSize,
      font,
      color: rgb(color.red, color.green, color.blue),
    });
    currentY -= fontSize + 4;
  }

  return { y: currentY, page: currentPage };
}

export async function POST(request: NextRequest) {
  try {
    const body: PDFRequest = await request.json();
    const { type, recommendations, executive_summary, generated_at } = body;

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    const margin = 50;
    const maxWidth = width - 2 * margin;
    let y = height - margin;

    // Colors
    const black = { red: 0, green: 0, blue: 0 };
    const gray = { red: 0.4, green: 0.4, blue: 0.4 };
    const darkGray = { red: 0.2, green: 0.2, blue: 0.2 };
    const red = { red: 0.93, green: 0.27, blue: 0.27 };
    const orange = { red: 0.96, green: 0.62, blue: 0.04 };
    const blue = { red: 0.13, green: 0.59, blue: 0.95 };
    const green = { red: 0.13, green: 0.77, blue: 0.37 };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'high': return red;
        case 'medium': return orange;
        case 'low': return blue;
        default: return gray;
      }
    };

    // Header
    page.drawText('MARS DIVERSIFIED', {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 30;

    if (type === 'executive') {
      // EXECUTIVE SUMMARY PDF
      page.drawText('Executive Summary', {
        x: margin,
        y,
        size: 24,
        font: fontBold,
        color: rgb(black.red, black.green, black.blue),
      });
      y -= 20;

      page.drawText(`Generated: ${generated_at || new Date().toLocaleDateString()}`, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(gray.red, gray.green, gray.blue),
      });
      y -= 40;

      // Summary stats
      const highCount = recommendations.filter(r => r.priority === 'high').length;
      const mediumCount = recommendations.filter(r => r.priority === 'medium').length;
      const lowCount = recommendations.filter(r => r.priority === 'low').length;

      page.drawText('Situation Overview', {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: rgb(darkGray.red, darkGray.green, darkGray.blue),
      });
      y -= 25;

      page.drawText(`Total Recommendations: ${recommendations.length}`, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(black.red, black.green, black.blue),
      });
      y -= 18;

      page.drawText(`Critical Issues (High Priority): ${highCount}`, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(red.red, red.green, red.blue),
      });
      y -= 18;

      page.drawText(`Medium Priority: ${mediumCount}`, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(orange.red, orange.green, orange.blue),
      });
      y -= 18;

      page.drawText(`Low Priority: ${lowCount}`, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(blue.red, blue.green, blue.blue),
      });
      y -= 35;

      // Executive Summary text
      if (executive_summary) {
        page.drawText('Summary', {
          x: margin,
          y,
          size: 14,
          font: fontBold,
          color: rgb(darkGray.red, darkGray.green, darkGray.blue),
        });
        y -= 20;

        const result = addText(page, executive_summary, margin, y, font, 10, gray, maxWidth);
        y = result.y;
        page = result.page;
        y -= 25;
      }

      // Critical Issues
      const highPriority = recommendations.filter(r => r.priority === 'high');
      if (highPriority.length > 0) {
        page.drawText('Critical Issues', {
          x: margin,
          y,
          size: 14,
          font: fontBold,
          color: rgb(red.red, red.green, red.blue),
        });
        y -= 20;

        for (const rec of highPriority) {
          const result = addText(page, `• ${rec.title}`, margin, y, font, 10, black, maxWidth);
          y = result.y;
          page = result.page;
          y -= 10;
        }
        y -= 15;
      }

      // Key Recommendations
      page.drawText('Key Recommendations', {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: rgb(darkGray.red, darkGray.green, darkGray.blue),
      });
      y -= 20;

      for (const rec of recommendations.slice(0, 5)) {
        const priorityColor = getPriorityColor(rec.priority);
        const result = addText(page, `• [${rec.priority.toUpperCase()}] ${rec.recommendation}`, margin, y, font, 10, priorityColor, maxWidth);
        y = result.y;
        page = result.page;
        y -= 10;
      }

    } else {
      // 30-DAY ACTION PLAN PDF
      page.drawText('30-Day Sales Action Plan', {
        x: margin,
        y,
        size: 24,
        font: fontBold,
        color: rgb(black.red, black.green, black.blue),
      });
      y -= 20;

      page.drawText(`Generated: ${generated_at || new Date().toLocaleDateString()}`, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(gray.red, gray.green, gray.blue),
      });
      y -= 40;

      // Group actions by week
      const week1: { action: string; priority: string; from: string }[] = [];
      const week2_3: { action: string; priority: string; from: string }[] = [];
      const week4: { action: string; priority: string; from: string }[] = [];

      for (const rec of recommendations) {
        for (let i = 0; i < rec.action_items.length; i++) {
          const item = { action: rec.action_items[i], priority: rec.priority, from: rec.title };
          if (rec.priority === 'high' || i === 0) {
            week1.push(item);
          } else if (rec.priority === 'medium') {
            week2_3.push(item);
          } else {
            week4.push(item);
          }
        }
      }

      // Week 1
      page.drawText('Week 1: Immediate Actions', {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: rgb(red.red, red.green, red.blue),
      });
      y -= 20;

      if (week1.length > 0) {
        for (const item of week1) {
          page.drawText('☐', {
            x: margin,
            y,
            size: 12,
            font,
            color: rgb(gray.red, gray.green, gray.blue),
          });
          const result = addText(page, item.action, margin + 20, y, font, 10, black, maxWidth - 20);
          y = result.y;
          page = result.page;
          y -= 5;
        }
      } else {
        page.drawText('No immediate actions', {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(gray.red, gray.green, gray.blue),
        });
        y -= 15;
      }
      y -= 20;

      // Week 2-3
      if (y < 100) {
        page = pdfDoc.addPage([612, 792]);
        y = height - margin;
      }

      page.drawText('Week 2-3: Follow-up Actions', {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: rgb(orange.red, orange.green, orange.blue),
      });
      y -= 20;

      if (week2_3.length > 0) {
        for (const item of week2_3) {
          page.drawText('☐', {
            x: margin,
            y,
            size: 12,
            font,
            color: rgb(gray.red, gray.green, gray.blue),
          });
          const result = addText(page, item.action, margin + 20, y, font, 10, black, maxWidth - 20);
          y = result.y;
          page = result.page;
          y -= 5;
        }
      } else {
        page.drawText('No follow-up actions', {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(gray.red, gray.green, gray.blue),
        });
        y -= 15;
      }
      y -= 20;

      // Week 4
      if (y < 100) {
        page = pdfDoc.addPage([612, 792]);
        y = height - margin;
      }

      page.drawText('Week 4: Review & Adjust', {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: rgb(blue.red, blue.green, blue.blue),
      });
      y -= 20;

      if (week4.length > 0) {
        for (const item of week4) {
          page.drawText('☐', {
            x: margin,
            y,
            size: 12,
            font,
            color: rgb(gray.red, gray.green, gray.blue),
          });
          const result = addText(page, item.action, margin + 20, y, font, 10, black, maxWidth - 20);
          y = result.y;
          page = result.page;
          y -= 5;
        }
      } else {
        page.drawText('No review actions scheduled', {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(gray.red, gray.green, gray.blue),
        });
        y -= 15;
      }
    }

    // Footer on all pages
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      pg.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: width / 2 - 30,
        y: 25,
        size: 9,
        font,
        color: rgb(gray.red, gray.green, gray.blue),
      });
      pg.drawText('Generated by MARS AI Insights', {
        x: margin,
        y: 25,
        size: 9,
        font,
        color: rgb(gray.red, gray.green, gray.blue),
      });
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF - convert Uint8Array to Buffer for NextResponse
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type === 'executive' ? 'Executive-Summary' : '30-Day-Action-Plan'}_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
