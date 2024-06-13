var MODE_SLASH = 0;
var MODE_TEXT = 1;
var MODE_WHITESPACE = 2;
var MODE_TAGNAME = 3;
var MODE_COMMENT = 4;
var MODE_PROP_SET = 5;
var MODE_PROP_APPEND = 6;
var CHILD_APPEND = 0;
var CHILD_RECURSE = 2;
var TAG_SET = 3;
var PROPS_ASSIGN = 4;
var PROP_SET = MODE_PROP_SET;
var PROP_APPEND = MODE_PROP_APPEND;

// Turn a result of a build(...) call into a tree that is more
// convenient to analyze and transform (e.g. Babel plugins).
// For example:
// 	treeify(
//		build`<div href="1${a}" ...${b}><${x} /></div>`,
//		[X, Y, Z]
//	)
// returns:
// 	{
// 		tag: 'div',
//		props: [ { href: ["1", X] }, Y ],
// 		children: [ { tag: Z, props: [], children: [] } ]
// 	}
var treeify = function (built, fields) {
  var _treeify = function (built) {
    var tag = '';
    var currentProps = null;
    var props = [];
    var children = [];
    for (var i = 1; i < built.length; i++) {
      var type = built[i++];
      var value = built[i] ? fields[built[i++] - 1] : built[++i];
      if (type === TAG_SET) {
        tag = value;
      } else if (type === PROPS_ASSIGN) {
        props.push(value);
        currentProps = null;
      } else if (type === PROP_SET) {
        if (!currentProps) {
          currentProps = Object.create(null);
          props.push(currentProps);
        }
        currentProps[built[++i]] = [value];
      } else if (type === PROP_APPEND) {
        currentProps[built[++i]].push(value);
      } else if (type === CHILD_RECURSE) {
        children.push(_treeify(value));
      } else if (type === CHILD_APPEND) {
        children.push(value);
      }
    }
    return {
      tag: tag,
      props: props,
      children: children
    };
  };
  var ref = _treeify(built);
  var children = ref.children;
  return children.length > 1 ? children : children[0];
};
var build = function (statics) {
  var mode = MODE_TEXT;
  var buffer = '';
  var quote = '';
  var current = [0];
  var char, propName;
  var commit = function (field) {
    if (mode === MODE_TEXT && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, '')))) {
      {
        current.push(CHILD_APPEND, field, buffer);
      }
    } else if (mode === MODE_TAGNAME && (field || buffer)) {
      {
        current.push(TAG_SET, field, buffer);
      }
      mode = MODE_WHITESPACE;
    } else if (mode === MODE_WHITESPACE && buffer === '...' && field) {
      {
        current.push(PROPS_ASSIGN, field, 0);
      }
    } else if (mode === MODE_WHITESPACE && buffer && !field) {
      {
        current.push(PROP_SET, 0, true, buffer);
      }
    } else if (mode >= MODE_PROP_SET) {
      {
        if (buffer || !field && mode === MODE_PROP_SET) {
          current.push(mode, 0, buffer, propName);
          mode = MODE_PROP_APPEND;
        }
        if (field) {
          current.push(mode, field, 0, propName);
          mode = MODE_PROP_APPEND;
        }
      }
    }
    buffer = '';
  };
  for (var i = 0; i < statics.length; i++) {
    if (i) {
      if (mode === MODE_TEXT) {
        commit();
      }
      commit(i);
    }
    for (var j = 0; j < statics[i].length; j++) {
      char = statics[i][j];
      if (mode === MODE_TEXT) {
        if (char === '<') {
          // commit buffer
          commit();
          {
            current = [current];
          }
          mode = MODE_TAGNAME;
        } else {
          buffer += char;
        }
      } else if (mode === MODE_COMMENT) {
        // Ignore everything until the last three characters are '-', '-' and '>'
        if (buffer === '--' && char === '>') {
          mode = MODE_TEXT;
          buffer = '';
        } else {
          buffer = char + buffer[0];
        }
      } else if (quote) {
        if (char === quote) {
          quote = '';
        } else {
          buffer += char;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        commit();
        mode = MODE_TEXT;
      } else if (!mode) ; else if (char === '=') {
        mode = MODE_PROP_SET;
        propName = buffer;
        buffer = '';
      } else if (char === '/' && (mode < MODE_PROP_SET || statics[i][j + 1] === '>')) {
        commit();
        if (mode === MODE_TAGNAME) {
          current = current[0];
        }
        mode = current;
        {
          (current = current[0]).push(CHILD_RECURSE, 0, mode);
        }
        mode = MODE_SLASH;
      } else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        // <a disabled>
        commit();
        mode = MODE_WHITESPACE;
      } else {
        buffer += char;
      }
      if (mode === MODE_TAGNAME && buffer === '!--') {
        mode = MODE_COMMENT;
        current = current[0];
      }
    }
  }
  commit();
  return current;
};

/**
 * @param {Babel} babel
 * @param {object} options
 * @param {string} [options.pragma=h]  JSX/hyperscript pragma.
 * @param {string} [options.tag=html]  The tagged template "tag" function name to process.
 * @param {string | boolean | object} [options.import=false]  Import the tag automatically
 * @param {boolean} [options.monomorphic=false]  Output monomorphic inline objects instead of using String literals.
 * @param {boolean} [options.useBuiltIns=false]  Use the native Object.assign instead of trying to polyfill it.
 * @param {boolean} [options.useNativeSpread=false]  Use the native { ...a, ...b } syntax for prop spreads.
 * @param {boolean} [options.variableArity=true] If `false`, always passes exactly 3 arguments to the pragma function.
 */
function htmBabelPlugin(ref, options) {
  var t = ref.types;
  if ( options === void 0 ) options = {};

  var pragmaString = options.pragma === false ? false : options.pragma || 'h';
  var pragma = pragmaString === false ? false : dottedIdentifier(pragmaString);
  var useBuiltIns = options.useBuiltIns;
  var useNativeSpread = options.useNativeSpread;
  var inlineVNodes = options.monomorphic || pragma === false;
  var importDeclaration = pragmaImport(options.import || false);
  function pragmaImport(imp) {
    if (pragmaString === false || imp === false) {
      return null;
    }
    var pragmaRoot = t.identifier(pragmaString.split('.')[0]);
    var ref = typeof imp !== 'string' ? imp : {
      module: imp,
      export: null
    };
    var module = ref.module;
    var export_ = ref.export;
    var specifier;
    if (export_ === '*') {
      specifier = t.importNamespaceSpecifier(pragmaRoot);
    } else if (export_ === 'default') {
      specifier = t.importDefaultSpecifier(pragmaRoot);
    } else {
      specifier = t.importSpecifier(pragmaRoot, export_ ? t.identifier(export_) : pragmaRoot);
    }
    return t.importDeclaration([specifier], t.stringLiteral(module));
  }
  function dottedIdentifier(keypath) {
    var path = keypath.split('.');
    var out;
    for (var i = 0; i < path.length; i++) {
      var ident = propertyName(path[i]);
      out = i === 0 ? ident : t.memberExpression(out, ident);
    }
    return out;
  }
  function patternStringToRegExp(str) {
    var parts = str.split('/').slice(1);
    var end = parts.pop() || '';
    return new RegExp(parts.join('/'), end);
  }
  function propertyName(key) {
    if (t.isValidIdentifier(key)) {
      return t.identifier(key);
    }
    return t.stringLiteral(key);
  }
  function objectProperties(obj) {
    return Object.keys(obj).map(function (key) {
      var values = obj[key].map(function (valueOrNode) { return t.isNode(valueOrNode) ? valueOrNode : t.valueToNode(valueOrNode); });
      var node = values[0];
      if (values.length > 1 && !t.isStringLiteral(node) && !t.isStringLiteral(values[1])) {
        node = t.binaryExpression('+', t.stringLiteral(''), node);
      }
      values.slice(1).forEach(function (value) {
        node = t.binaryExpression('+', node, value);
      });
      return t.objectProperty(propertyName(key), node);
    });
  }
  function stringValue(str) {
    if (options.monomorphic) {
      return t.objectExpression([t.objectProperty(propertyName('type'), t.numericLiteral(3)), t.objectProperty(propertyName('tag'), t.nullLiteral()), t.objectProperty(propertyName('props'), t.nullLiteral()), t.objectProperty(propertyName('children'), t.nullLiteral()), t.objectProperty(propertyName('text'), t.stringLiteral(str))]);
    }
    return t.stringLiteral(str);
  }
  function createVNode(tag, props, children) {
    // Never pass children=[[]].
    if (children.elements.length === 1 && t.isArrayExpression(children.elements[0]) && children.elements[0].elements.length === 0) {
      children = children.elements[0];
    }
    if (inlineVNodes) {
      return t.objectExpression([options.monomorphic && t.objectProperty(propertyName('type'), t.numericLiteral(1)), t.objectProperty(propertyName('tag'), tag), t.objectProperty(propertyName('props'), props), t.objectProperty(propertyName('children'), children), options.monomorphic && t.objectProperty(propertyName('text'), t.nullLiteral())].filter(Boolean));
    }

    // Passing `{variableArity:false}` always produces `h(tag, props, children)` - where `children` is always an Array.
    // Otherwise, the default is `h(tag, props, ...children)`.
    if (options.variableArity !== false) {
      children = children.elements;
    }
    return t.callExpression(pragma, [tag, props].concat(children));
  }
  function spreadNode(args, state) {
    if (args.length === 0) {
      return t.nullLiteral();
    }
    if (args.length > 0 && t.isNode(args[0])) {
      args.unshift({});
    }

    // 'Object.assign(x)', can be collapsed to 'x'.
    if (args.length === 1) {
      return propsNode(args[0]);
    }
    // 'Object.assign({}, x)', can be collapsed to 'x'.
    if (args.length === 2 && !t.isNode(args[0]) && Object.keys(args[0]).length === 0) {
      return propsNode(args[1]);
    }
    if (useNativeSpread) {
      var properties = [];
      args.forEach(function (arg) {
        if (t.isNode(arg)) {
          properties.push(t.spreadElement(arg));
        } else {
          properties.push.apply(properties, objectProperties(arg));
        }
      });
      return t.objectExpression(properties);
    }
    var helper = useBuiltIns ? dottedIdentifier('Object.assign') : state.addHelper('extends');
    return t.callExpression(helper, args.map(propsNode));
  }
  function propsNode(props) {
    return t.isNode(props) ? props : t.objectExpression(objectProperties(props));
  }
  function transform(node, state) {
    if (t.isNode(node)) { return node; }
    if (typeof node === 'string') { return stringValue(node); }
    if (typeof node === 'undefined') { return t.identifier('undefined'); }
    var tag = node.tag;
    var props = node.props;
    var children = node.children;
    var newTag = typeof tag === 'string' ? t.stringLiteral(tag) : tag;
    var newProps = spreadNode(props, state);
    var newChildren = t.arrayExpression(children.map(function (child) { return transform(child, state); }));
    return createVNode(newTag, newProps, newChildren);
  }

  // The tagged template tag function name we're looking for.
  // This is static because it's generally assigned via htm.bind(h),
  // which could be imported from elsewhere, making tracking impossible.
  var htmlName = options.tag || 'html';
  return {
    name: 'htm',
    visitor: {
      Program: {
        exit: function exit(path, state) {
          if (state.get('hasHtm') && importDeclaration) {
            path.unshiftContainer('body', importDeclaration);
          }
        }
      },
      TaggedTemplateExpression: function TaggedTemplateExpression(path, state) {
        var tag = path.node.tag.name;
        if (htmlName[0] === '/' ? patternStringToRegExp(htmlName).test(tag) : tag === htmlName) {
          var statics = path.node.quasi.quasis.map(function (e) { return e.value.raw; });
          var expr = path.node.quasi.expressions;
          var tree = treeify(build(statics), expr);
          var node = !Array.isArray(tree) ? transform(tree, state) : t.arrayExpression(tree.map(function (root) { return transform(root, state); }));
          path.replaceWith(node);
          state.set('hasHtm', true);
        }
      }
    }
  };
}

export default htmBabelPlugin;
