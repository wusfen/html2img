async function html2img(el = document.documentElement, type=undefined, quality=undefined) {
  // create canvas
  var canvas = document.getElementById('html2imgCanvas')
  canvas = canvas || document.createElement('canvas')
  canvas.id = 'html2imgCanvas'
  Object.assign(canvas.style, {
    position: 'absolute',
    zIndex: 9999999999,
    top: 0,
    right: 0,
    width: '40%',
    background: '#fff',
    transition: '.3s',
    boxShadow: '1px 1px 15px #333',
    // pointerEvents: 'none',
    display: 'none',
  })
  canvas.width = el.offsetWidth
  canvas.height = el.offsetHeight
  canvas._noDraw = true
  document.body.appendChild(canvas)
  var context = canvas.getContext('2d')

  // root
  var root = el
  var rootRect = root.getBoundingClientRect()
  var rootX = rootRect.x
  var rootY = rootRect.y
  await draw(root)

  async function draw(el) {
    if (el._noDraw) return

    if (el.nodeType == 1) {
      var style = getComputedStyle(el)
      // display
      if (style.display == 'none') {
        return
      }

      await drawElement(el)
      var childNodes = [...el.childNodes]
      for (var i = 0; i < childNodes.length; i++) {
        var childNode = childNodes[i]
        await draw(childNode)
      }
    }
    if (el.nodeType == 3) {
      drawText(el)
    }
  }

  async function drawElement(el) {
    context.save()

    // style
    var rect = el.getBoundingClientRect()
    var style = getComputedStyle(el)
    var x = rect.x - rootX
    var y = rect.y - rootY
    var w = rect.width
    var h = rect.height
    var r = parseFloat(style.borderRadius)
    var tlr = parseFloat(style.borderTopLeftRadius)
    var trr = parseFloat(style.borderTopRightRadius)
    var brr = parseFloat(style.borderBottomRightRadius)
    var blr = parseFloat(style.borderBottomLeftRadius)
    r = Math.min(r, w / 2, h / 2)
    tlr = Math.min(tlr, w / 2, h / 2)
    trr = Math.min(trr, w / 2, h / 2)
    brr = Math.min(brr, w / 2, h / 2)
    blr = Math.min(blr, w / 2, h / 2)

    // offset rect borderRadius
    context.beginPath()
    // top left
    context.moveTo(x + tlr, y)
    // top right
    context.lineTo(x + w - trr, y)
    context.arc(x + w - trr, y + trr, trr, -Math.PI / 2, 0)
    // bottom right
    context.lineTo(x + w, y + h - brr)
    context.arc(x + w - brr, y + h - brr, brr, 0, Math.PI / 2)
    // bottom left
    context.lineTo(x + blr, y + h)
    context.arc(x + blr, y + h - blr, blr, Math.PI / 2, Math.PI)
    // top left
    context.lineTo(x, y + tlr)
    context.arc(x + tlr, y + tlr, tlr, Math.PI, -Math.PI / 2)

    // boxShadow. todo multi, inset
    var bs = style.boxShadow
    var bsm = bs.match(/(.*) (.*px) (.*px) (.*px) (.*px)(?=,|$)/)
    if (bsm) {
      context.shadowColor = bsm[1]
      context.shadowOffsetX = parseFloat(bsm[2])
      context.shadowOffsetY = parseFloat(bsm[3])
      context.shadowBlur = parseFloat(bsm[4])
    }
    if (bsm && style.backgroundColor === 'rgba(0, 0, 0, 0)') {
      context.fillStyle = '#fff'
      context.fill()
    }

    // opacity
    context.globalAlpha = style.opacity

    // backgroundColor
    context.fillStyle = style.backgroundColor
    context.fill()

    // overflow
    context.clip()

    // backgrounImage
    var bgi = style.backgroundImage
    var bgim = bgi.match(/^url\("(.*?)"\)/)
    if (bgim) {
      var bgImg = await getImg(bgim[1])

      // backgroundSize  todo cover '-px'
      var bgiw = bgImg.width
      var bgih = bgImg.height
      if (style.backgroundSize === 'contain') {
        if (bgiw > w) {
          bgih = (w * bgih) / bgiw
          bgiw = w
        }
        if (bgih > h) {
          bgiw = (h * bgiw) / bgih
          bgih = h
        }
      }
      // backgroundPosision  todo '-px' '-%'
      var bgix = x
      var bgiy = y
      if (style.backgroundPositionX === '50%') {
        bgix = x + (w - bgiw) / 2
      }
      if (style.backgroundPositionY === '50%') {
        bgiy = y + (h - bgih) / 2
      }

      bgImg.width && context.drawImage(bgImg, bgix, bgiy, bgiw, bgih)
    }

    // borderImage
    var bdi = style.borderImage
    var bdim = bdi.match(/^url\("(.*?)"\)/)
    if (bdim) {
      var bdImg = await getImg(bdim[1])
      bdImg.width && context.drawImage(bdImg, x, y, w, h)
    }

    // img
    if (el instanceof Image && el.getAttribute('src')) {
      var img = await getImg(el.src)
      img.width && context.drawImage(img, x, y, w, h)
    }

    // canvas
    if (el.tagName.toLowerCase() === 'canvas') {
      try {
        el.toDataURL()
        context.drawImage(el, x, y, w, h)
      } catch (e) {
        console.warn('[draw canvas error]', el, e)
      }
    }

    // svg
    if (el.tagName.toLowerCase() === 'svg') {
      try {
        var dataURI = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(el.outerHTML)))
        var svgImg = await getImg(dataURI)
        context.drawImage(svgImg, x, y, w, h)
      } catch (e) {
        console.warn('[draw svg error]', el, e)
      }
    }

    // border
    var bdw = parseFloat(style.borderWidth)
    context.lineWidth = bdw
    context.strokeStyle = style.borderColor || style.color
    bdw && context.stroke()
    // context.stroke()

    context.restore()
  }

  async function drawText(node) {
    var text = node.nodeValue
    if (!text.trim()) return
    context.save()

    // temp el
    var textEl = node._textEl || document.createElement('_text_')
    textEl._noDraw = true
    node._textEl = textEl
    node.parentNode.insertBefore(textEl, node)
    textEl.appendChild(node)
    textEl._textNode = node

    // position
    var rect = textEl.getBoundingClientRect()
    var x = rect.x - rootX
    var y = rect.y - rootY
    var w = rect.width
    var h = rect.height

    // style
    var style = getComputedStyle(textEl)
    context.font = style.font
    context.fillStyle = style.color
    var fs = parseFloat(style.fontSize)
    var lh = parseFloat(style.lineHeight) || fs * 1.15 // || normal

    // textAlign
    context.textAlign = style.textAlign
    if (context.textAlign === 'center') {
      x = x + w / 2
    }
    if (context.textAlign === 'right') {
      x = x + w
    }

    // letterSpacing ??
    canvas.style.letterSpacing = style.letterSpacing

    // whiteSpace
    var lines = []
    if (style.whiteSpace.match('pre')) {
      // pre
      lines = text.split('\n')
      // pre-line
      if (style.whiteSpace.match('pre-line')) {
        lines = text.split('\n').map(line=>line.trim())
      }
    } else {
      // normal, nowrap
      text = text.trim().replace(/\s+/g, ' ')
      lines = [text] // line{1}
      // nowmal(wrap) line{2,}
      if (h >= fs * 2) {
        lines = []
        var line = ''
        for (let i = 0; i < text.length; i++) {
          line += text[i]
          if (context.measureText(line).width > w) {
            lines.push(line.trim())
            line = ''
          }
        }
        line && lines.push(line.trim())
      }
    }
    // console.log(lines)

    // draw
    context.textBaseline = 'alphabetic'
    lines.forEach((line, i) => {
      var ly = y + i * lh + fs // _T_
      context.fillText(line, x, ly, w) // [-w-  ]
    })

    // - temp el
    textEl.parentNode.insertBefore(node, textEl)
    textEl.parentNode.removeChild(textEl)

    context.restore()
  }

  var dataURL = canvas.toDataURL(type, quality)
  var img = new Image()
  img.src = dataURL
  img.canvas = canvas
  return img
}

/**
 * 'http://domain.com/img.png' => <img src="data:">
 * @param {string} url
 * @returns {promise<image?>} img
 */
async function getImg(url) {
  return new Promise(rs => {
    imgUrl2DataUrl(url)
      .then(dataUrl => {
        var img = new Image()
        img.src = dataUrl
        img.onload = function() {
          rs(img)
        }
        img.onerror = function(e) {
          console.warn('[draw getImg onerror]', url, e)
          rs(new Image())
        }
      })
      .catch(e => {
        console.warn('[draw getImg error]', url, e)
        rs(new Image())
      })
  })
}

/**
 * 'http://domain.com/img.png' => await 'data:image/png;base64,'
 * @param {string} url img.src
 * @returns {promise} 'data:image/png;base64,'
 */
async function imgUrl2DataUrl(url) {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'blob'
    xhr.onload = function() {
      if (String(this.status).match(/^(2..|304)/)) {
        var blob = this.response
        var fileReader = new FileReader()
        fileReader.onloadend = function(e) {
          var result = e.target.result
          resolve(result)
        }
        fileReader.readAsDataURL(blob)
      } else {
        reject()
      }
    }
    xhr.onerror = function() {
      reject()
    }
    xhr.send()
  })
}

if (typeof exports === 'object') {
  exports.default = html2img
} else {
  window.html2img = html2img
}
