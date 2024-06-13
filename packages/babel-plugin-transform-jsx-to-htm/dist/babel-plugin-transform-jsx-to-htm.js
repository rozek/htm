function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var jsx = _interopDefault(require('@babel/plugin-syntax-jsx'));

/**
 * @param {Babel} babel
 * @param {object} [options]
 * @param {string} [options.tag='html']  The tagged template "tag" function name to produce.
 * @param {boolean} [options.terse=false]  Use `<//>` for closing component tags
 * @param {string | boolean | object} [options.import=false]  Import the tag automatically
 */
function jsxToHtmBabelPlugin(ref, options) {
  var t = ref.types;
  if ( options === void 0 ) options = {};

  var tagString = options.tag || 'html';
  var tag = dottedIdentifier(tagString);
  var importDeclaration = tagImport(options.import || false);
  var terse = options.terse === true;
  function tagImport(imp) {
    if (imp === false) {
      return null;
    }
    var tagRoot = t.identifier(tagString.split('.')[0]);
    var ref = typeof imp !== 'string' ? imp : {
      module: imp,
      export: null
    };
    var module = ref.module;
    var export_ = ref.export;
    var specifier;
    if (export_ === '*') {
      specifier = t.importNamespaceSpecifier(tagRoot);
    } else if (export_ === 'default') {
      specifier = t.importDefaultSpecifier(tagRoot);
    } else {
      specifier = t.importSpecifier(tagRoot, export_ ? t.identifier(export_) : tagRoot);
    }
    return t.importDeclaration([specifier], t.stringLiteral(module));
  }
  function dottedIdentifier(keypath) {
    var path = keypath.split('.');
    var out;
    for (var i = 0; i < path.length; i++) {
      var ident = t.identifier(path[i]);
      out = i === 0 ? ident : t.memberExpression(out, ident);
    }
    return out;
  }
  var quasis = [];
  var expressions = [];
  function expr(value) {
    expressions.push(value);
    quasis.push(t.templateElement({
      raw: '',
      cooked: ''
    }));
  }
  function raw(str) {
    var last = quasis[quasis.length - 1];
    last.value.raw += str;
    last.value.cooked += str;
  }
  function escapeText(text) {
    if (text.indexOf('<') < 0) {
      return raw(text);
    }
    return expr(t.stringLiteral(text));
  }
  function escapePropValue(node) {
    var value = node.value;
    if (value.match(/^(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*$/)) {
      if (value.indexOf('"') < 0) {
        return raw(("\"" + value + "\""));
      } else if (value.indexOf("'") < 0) {
        return raw(("'" + value + "'"));
      }
    }
    return expr(t.stringLiteral(node.value));
  }
  var FRAGMENT_EXPR = dottedIdentifier('React.Fragment');
  function isFragmentName(node) {
    return t.isNodesEquivalent(FRAGMENT_EXPR, node);
  }
  function isComponentName(node) {
    if (t.isJSXNamespacedName(node)) { return false; }
    return !t.isIdentifier(node) || node.name.match(/^[$_A-Z]/);
  }
  function getNameExpr(node) {
    if (t.isJSXNamespacedName(node)) {
      return t.identifier(node.namespace.name + ':' + node.name.name);
    }
    if (!t.isJSXMemberExpression(node)) {
      return t.identifier(node.name);
    }
    return t.memberExpression(getNameExpr(node.object), t.identifier(node.property.name));
  }
  function processChildren(node, name, isFragment) {
    var children = t.react.buildChildren(node);
    if (children && children.length !== 0) {
      if (!isFragment) {
        raw('>');
      }
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (t.isStringLiteral(child)) {
          escapeText(child.value);
        } else if (t.isJSXElement(child)) {
          processNode(child);
        } else {
          expr(child);
        }
      }
      if (!isFragment) {
        if (isComponentName(name)) {
          if (terse) {
            raw('<//>');
          } else {
            raw('</');
            expr(name);
            raw('>');
          }
        } else {
          raw('</');
          raw(name.name);
          raw('>');
        }
      }
    } else if (!isFragment) {
      raw('/>');
    }
  }
  function processNode(node, path, isRoot) {
    var open = node.openingElement;
    var name = getNameExpr(open.name);
    var isFragment = isFragmentName(name);
    if (!isFragment) {
      if (isComponentName(name)) {
        raw('<');
        expr(name);
      } else {
        raw('<');
        raw(name.name);
      }
      if (open.attributes) {
        for (var i = 0; i < open.attributes.length; i++) {
          var attr = open.attributes[i];
          raw(' ');
          if (t.isJSXSpreadAttribute(attr)) {
            raw('...');
            expr(attr.argument);
            continue;
          }
          var name$1 = attr.name;
          var value = attr.value;
          if (t.isJSXNamespacedName(name$1)) {
            raw(name$1.namespace.name + ':' + name$1.name.name);
          } else {
            raw(name$1.name);
          }
          if (value) {
            raw('=');
            if (value.expression) {
              expr(value.expression);
            } else if (t.isStringLiteral(value)) {
              escapePropValue(value);
            } else {
              expr(value);
            }
          }
        }
      }
    }
    processChildren(node, name, isFragment);
    if (isRoot) {
      var template = t.templateLiteral(quasis, expressions);
      var replacement = t.taggedTemplateExpression(tag, template);
      path.replaceWith(replacement);
    }
  }
  function jsxVisitorHandler(path, state, isFragment) {
    var quasisBefore = quasis;
    var expressionsBefore = expressions;
    quasis = [t.templateElement({
      raw: '',
      cooked: ''
    })];
    expressions = [];
    if (isFragment) {
      processChildren(path.node, null, true);
      var template = t.templateLiteral(quasis, expressions);
      var replacement = t.taggedTemplateExpression(tag, template);
      path.replaceWith(replacement);
    } else {
      processNode(path.node, path, true);
    }
    quasis = quasisBefore;
    expressions = expressionsBefore;
    state.set('jsxElement', true);
  }
  return {
    name: 'transform-jsx-to-htm',
    inherits: jsx,
    visitor: {
      Program: {
        exit: function exit(path, state) {
          if (state.get('jsxElement') && importDeclaration) {
            path.unshiftContainer('body', importDeclaration);
          }
        }
      },
      JSXElement: function JSXElement(path, state) {
        jsxVisitorHandler(path, state, false);
      },
      JSXFragment: function JSXFragment(path, state) {
        jsxVisitorHandler(path, state, true);
      }
    }
  };
}

module.exports = jsxToHtmBabelPlugin;
