/* Renders the portfolio template (#tpl) with React.
   Supports the same template features the design canvas used:
   {{holes}}, <sc-if>, <sc-for>, event handlers, and state via setState. */
(function () {
  'use strict';
  var h = React.createElement;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var ANY = /\{\{\s*([^}]+?)\s*\}\}/g;
  var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
  var EVENTS = {
    onclick: 'onClick', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus',
    onblur: 'onBlur', onchange: 'onChange', oninput: 'onInput', onkeydown: 'onKeyDown', onmouseover: 'onMouseOver'
  };
  var ATTRS = {
    'class': 'className', 'for': 'htmlFor', tabindex: 'tabIndex', playsinline: 'playsInline',
    allowfullscreen: 'allowFullScreen', referrerpolicy: 'referrerPolicy', crossorigin: 'crossOrigin',
    autoplay: 'autoPlay', srcset: 'srcSet', readonly: 'readOnly', maxlength: 'maxLength', colspan: 'colSpan',
    rowspan: 'rowSpan', datetime: 'dateTime', viewbox: 'viewBox'
  };
  var BOOL = { controls: 1, playsinline: 1, muted: 1, loop: 1, autoplay: 1, allowfullscreen: 1, disabled: 1, hidden: 1, checked: 1, selected: 1, open: 1 };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$/.test(path) || /^".*"$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.');
    var v;
    for (var i = scope.length - 1; i >= 0; i--) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) { v = scope[i][parts[0]]; break; }
    }
    for (var k = 1; k < parts.length && v != null; k++) v = v[parts[k]];
    return v;
  }

  function interp(str, scope) {
    var m = str.match(WHOLE);
    if (m) return lookup(m[1], scope);
    if (str.indexOf('{{') === -1) return str;
    return str.replace(ANY, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }

  function camel(prop) {
    if (prop.indexOf('--') === 0) return prop;
    if (prop.indexOf('-ms-') === 0) prop = prop.slice(1);
    return prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  var styleCache = {};
  function styleObj(s) {
    if (s == null || s === '') return undefined;
    if (typeof s !== 'string') return s;
    if (styleCache[s]) return styleCache[s];
    var out = {}, depth = 0, start = 0, decls = [];
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ';' && depth === 0) { decls.push(s.slice(start, i)); start = i + 1; }
    }
    decls.push(s.slice(start));
    decls.forEach(function (d) {
      var idx = d.indexOf(':');
      if (idx < 0) return;
      var prop = d.slice(0, idx).trim();
      var val = d.slice(idx + 1).trim();
      if (!prop || val === '') return;
      out[camel(prop)] = val;
    });
    styleCache[s] = out;
    return out;
  }

  function renderChildren(node, scope) {
    var kids = [];
    var inSvg = node.namespaceURI === SVG_NS;
    var i = 0;
    for (var c = node.firstChild; c; c = c.nextSibling) {
      var r = renderNode(c, scope, i++, inSvg);
      if (r === null || r === undefined) continue;
      kids.push(r);
    }
    return kids;
  }

  function renderNode(node, scope, key, inSvg) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      if (/^\s*$/.test(t)) return inSvg ? null : (t.length ? ' ' : null);
      return interp(t, scope);
    }
    if (node.nodeType !== 1) return null;
    var tag = node.localName;
    if (tag === 'helmet' || tag === 'script') return null;
    if (tag === 'sc-if') {
      if (!lookup((node.getAttribute('value') || '').replace(/^\{\{|\}\}$/g, ''), scope)) return null;
      return h(React.Fragment, { key: key }, renderChildren(node, scope));
    }
    if (tag === 'sc-for') {
      var list = lookup((node.getAttribute('list') || '').replace(/^\{\{|\}\}$/g, ''), scope) || [];
      var as = node.getAttribute('as') || 'item';
      return h(React.Fragment, { key: key }, list.map(function (item, idx) {
        var frame = { $index: idx };
        frame[as] = item;
        return h(React.Fragment, { key: idx }, renderChildren(node, scope.concat([frame])));
      }));
    }
    var isSvg = node.namespaceURI === SVG_NS;
    var props = { key: key };
    for (var a = 0; a < node.attributes.length; a++) {
      var attr = node.attributes[a];
      var name = attr.name;
      if (name.indexOf('hint-') === 0) continue;
      var raw = attr.value;
      var val = interp(raw, scope);
      if (name === 'style') { props.style = styleObj(val); continue; }
      if (name.indexOf('on') === 0 && EVENTS[name]) { if (typeof val === 'function') props[EVENTS[name]] = val; continue; }
      if (BOOL[name]) {
        var b = raw === '' ? true : (val === 'true' ? true : (val === 'false' ? false : !!val));
        props[ATTRS[name] || name] = b;
        continue;
      }
      if (name.indexOf('aria-') === 0 || name.indexOf('data-') === 0) {
        props[name] = typeof val === 'boolean' ? String(val) : val;
        continue;
      }
      if (ATTRS[name]) { props[ATTRS[name]] = val; continue; }
      if (isSvg && name.indexOf('-') > 0) { props[camel(name)] = val; continue; }
      props[name] = val;
    }
    if (VOID[tag]) return h(tag, props);
    var kids = renderChildren(node, scope);
    return h.apply(null, [tag, props].concat(kids));
  }

  var tpl = document.getElementById('tpl');
  var ROOT = tpl.content;

  window.DCLogic = class DCLogic extends React.Component {
    render() {
      var vals = this.renderVals();
      return h(React.Fragment, null, renderChildren(ROOT, [vals]));
    }
  };

  window.__mountPortfolio = function (Component, props) {
    var root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(h(Component, props));
  };
})();
