Add-Type -AssemblyName System.Drawing

function Render-Bmp([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $g.Clear([System.Drawing.Color]::Transparent)

    $margin = [Math]::Max(1, [int]($size * 0.05))
    $boxSize = $size - ($margin * 2)
    $radius = [Math]::Max(2, [int]($size * 0.2))
    $diameter = $radius * 2

    $rect = New-Object System.Drawing.Rectangle $margin, $margin, $boxSize, $boxSize
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $arc = New-Object System.Drawing.Rectangle $rect.X, $rect.Y, $diameter, $diameter
    $path.AddArc($arc, 180, 90)
    $arc.X = $rect.Right - $diameter
    $path.AddArc($arc, 270, 90)
    $arc.Y = $rect.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    $arc.X = $rect.X
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()

    # Gradient: #2fcdd1 to #47e6a4
    $c1 = [System.Drawing.Color]::FromArgb(255, 0x2f, 0xcd, 0xd1)
    $c2 = [System.Drawing.Color]::FromArgb(255, 0x47, 0xe6, 0xa4)
    $p1 = New-Object System.Drawing.Point $margin, $margin
    $p2 = New-Object System.Drawing.Point ($margin + $boxSize), ($margin + $boxSize)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $p1, $p2, $c1, $c2
    $g.FillPath($brush, $path)

    # Border
    $penColor = [System.Drawing.Color]::FromArgb(90, 255, 255, 255)
    $borderW = [Math]::Max(1.0, [double]($size * 0.025))
    $pen = New-Object System.Drawing.Pen $penColor, ([single]$borderW)
    $g.DrawPath($pen, $path)

    # Text AT
    $fontSize = [Math]::Max(7.0, [double]($size * 0.40))
    $font = New-Object System.Drawing.Font 'Arial', ([single]$fontSize), 'Bold', 'Pixel'
    $textColor = [System.Drawing.Color]::FromArgb(255, 0x02, 0x13, 0x1a)
    $textBrush = New-Object System.Drawing.SolidBrush $textColor
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF $margin, ($margin + ($size * 0.03)), $boxSize, $boxSize
    $g.DrawString('AT', $font, $textBrush, $textRect, $sf)

    $brush.Dispose()
    $pen.Dispose()
    $font.Dispose()
    $textBrush.Dispose()
    $path.Dispose()
    $g.Dispose()

    return $bmp
}

$sizes = @(256, 64, 48, 32, 16)
$pngDatas = @()

foreach ($sz in $sizes) {
    $bmp = Render-Bmp $sz
    if ($sz -eq 256) {
        $bmp.Save('c:\Users\aladi\VScode_Projects\AlertTrader_Strategy\icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngDatas += ,@($sz, $ms.ToArray())
    $ms.Dispose()
    $bmp.Dispose()
}

$fs = [System.IO.File]::Create('c:\Users\aladi\VScode_Projects\AlertTrader_Strategy\icon.ico')
$bw = New-Object System.IO.BinaryWriter $fs

$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$offset = 6 + ($sizes.Count * 16)

foreach ($item in $pngDatas) {
    $sz = $item[0]
    $bytes = $item[1]

    $w = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)

    $offset += $bytes.Length
}

foreach ($item in $pngDatas) {
    $bw.Write($item[1])
}

$bw.Flush()
$bw.Close()
$fs.Close()

Write-Output 'Multi-res ICO and PNG created successfully.'
