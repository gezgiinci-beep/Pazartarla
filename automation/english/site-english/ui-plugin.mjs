import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const VIRTUAL_ID = 'virtual:pazartarla-site-english';
const SAFE_ATTRIBUTES = new Set(['label', 'placeholder', 'title', 'alt', 'aria-label']);
const TOAST_METHODS = new Set(['error', 'success', 'warning', 'info']);
const DYNAMIC_RECORD_ROOTS = new Set(['article', 'listing', 'news', 'story', 'entry', 'data', 'evergreenGuide', 'breakingNews', 'selectedListing', 'guide', 'featuredOffer', 'offer']);
const DYNAMIC_RECORD_FIELDS = new Set(['title', 'description', 'excerpt', 'body', 'author_comment']);
const UI_LABEL_ROOTS=new Set(['cat','subCat','subcategory','category','categoryLabel','subCategory','selectedCategory','selectedSubCategory','tab','step','link','option','navItem','filterOption','announcement']);
const UI_CONFIG_ARRAYS=new Set(['categories','subcategories','categoryoptions','subcategoryoptions','menuitems','navitems','tabs','steps','filteroptions']);
function isPublicConfigLabel(expression){
  if(!ts.isPropertyAccessExpression(expression)||expression.name.text!=='label'||!ts.isIdentifier(expression.expression))return false;
  for(let parent=expression.parent;parent;parent=parent.parent){
    if(!ts.isCallExpression(parent)||!ts.isPropertyAccessExpression(parent.expression)||parent.expression.name.text!=='map')continue;
    const array=parent.expression.expression,callback=parent.arguments[0];
    return ts.isIdentifier(array)&&UI_CONFIG_ARRAYS.has(array.text.toLowerCase())
      &&callback&&(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))
      &&callback.parameters[0]&&ts.isIdentifier(callback.parameters[0].name)
      &&callback.parameters[0].name.text===expression.expression.text;
  }
  return false;
}
const ERROR_MESSAGE_NAMES = new Set(['message']);

function normalizedPath(filename) {
  return String(filename || '').replace(/\\/g, '/').split('?')[0];
}

function supportedFile(filename) {
  const id = normalizedPath(filename);
  const marketplace = id.includes('/external/pazartarla/src/') || id.startsWith('external/pazartarla/src/');
  const gazette = id.includes('/artifacts/pazartarla-gazete/src/') || id.startsWith('artifacts/pazartarla-gazete/src/');
  return (/\.(?:tsx|jsx)$/.test(id) && (marketplace || gazette))
    || (marketplace && id.endsWith('.mjs'))
    || (gazette && id.endsWith('/src/lib/gazette-api.ts'));
}

function projectScope(filename) {
  const id = normalizedPath(filename);
  return id.includes('/artifacts/pazartarla-gazete/src/') || id.startsWith('artifacts/pazartarla-gazete/src/')
    ? 'gazette'
    : 'marketplace';
}

function stringValue(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : null;
}

function humanErrorText(value) {
  return typeof value === 'string' && /\s/.test(value)
    && !isCodeLike(value)
    && !/^(?:https?:|mailto:)/i.test(value.trim());
}

function isCodeLike(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value.trim());
}

function isErrorMapValue(node) {
  const property = node.parent;
  if (!ts.isPropertyAssignment(property) || property.initializer !== node
    || !ts.isObjectLiteralExpression(property.parent)) return false;
  const declaration = property.parent.parent;
  return ts.isVariableDeclaration(declaration)
    && /_ERROR_MESSAGES$/i.test(propertyName(declaration.name));
}

function isRequestMessageBranch(node) {
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent)) {
      if (parent.whenTrue !== current && parent.whenFalse !== current) return false;
      current = parent;
      continue;
    }
    if (ts.isBinaryExpression(parent)) {
      if (parent.right !== current || (parent.operatorToken.kind !== ts.SyntaxKind.BarBarToken
        && parent.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken)) return false;
      current = parent;
      continue;
    }
    if (ts.isVariableDeclaration(parent) && ERROR_MESSAGE_NAMES.has(propertyName(parent.name))) {
      let owner = parent.parent;
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
      return ts.isFunctionDeclaration(owner) && owner.name?.text === 'requestJson';
    }
    if (ts.isSourceFile(parent) || ts.isFunctionDeclaration(parent)) return false;
    current = parent;
  }
  return false;
}

function isErrorConstructorArgument(node) {
  const call = node.parent;
  return (ts.isNewExpression(call) || ts.isCallExpression(call))
    && (ts.isIdentifier(call.expression) && call.expression.text === 'Error')
    && call.arguments?.[0] === node;
}

function isDirectDevFlag(node, source) {
  return node.getText(source) === 'import.meta.env.DEV';
}

function usesTurkishDisplayLocale(expression, methodName) {
  if (!ts.isPropertyAccessExpression(expression)) return false;
  if (methodName && expression.name.text !== methodName) return false;
  if (methodName === 'toLocaleDateString') return true;
  return ts.isIdentifier(expression.expression) && expression.expression.text === 'Intl'
    && (expression.name.text === 'DateTimeFormat' || expression.name.text === 'NumberFormat');
}

function propertyName(node) {
  if (!node) return '';
  return ts.isIdentifier(node) || ts.isPrivateIdentifier(node) ? node.text : node.getText();
}

function isDynamicPublicText(node, filename = '') {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)
    || ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression;
  if (!ts.isPropertyAccessExpression(current)
    || !DYNAMIC_RECORD_FIELDS.has(current.name.text)) return false;
  let root = current.expression;
  while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)) {
    root = ts.isPropertyAccessExpression(root) ? root.expression : root.expression;
  }
  if (!ts.isIdentifier(root)) return false;
  if (DYNAMIC_RECORD_ROOTS.has(root.text)) return true;
  return root.text === 'item' && isPublicListingCardNode(node, filename);
}

function isPublicListingCardNode(node, filename) {
  const id = normalizedPath(filename);
  if (!(id.endsWith('/external/pazartarla/src/App.tsx') || id === 'external/pazartarla/src/App.tsx')) return false;
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const attrs = current.openingElement.attributes.properties;
      for (const attr of attrs) {
        if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name) || !attr.initializer) continue;
        if (attr.name.text === 'id' && ts.isStringLiteral(attr.initializer)
          && ['home-featured-listings', 'home-listings-section'].includes(attr.initializer.text)) return true;
        if (attr.name.text === 'data-testid') {
          const value = ts.isStringLiteral(attr.initializer)
            ? attr.initializer.text
            : ts.isJsxExpression(attr.initializer) && attr.initializer.expression
              ? attr.initializer.expression.getText()
              : '';
          if (/home-listing-|result-listing-/.test(value)) return true;
        }
      }
    }
    current = current.parent;
  }
  return false;
}

function publicDisplayExpression(node, factory, filename) {
  if (isDynamicPublicText(node, filename)) return makeCall(factory, '__ptEnglishText', [node]);
  if (ts.isParenthesizedExpression(node)) {
    const inner = publicDisplayExpression(node.expression, factory, filename);
    return inner === node.expression ? node : factory.updateParenthesizedExpression(node, inner);
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = publicDisplayExpression(node.whenTrue, factory, filename);
    const whenFalse = publicDisplayExpression(node.whenFalse, factory, filename);
    return whenTrue === node.whenTrue && whenFalse === node.whenFalse ? node
      : factory.updateConditionalExpression(node, node.condition, node.questionToken, whenTrue, node.colonToken, whenFalse);
  }
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    const left = publicDisplayExpression(node.left, factory, filename);
    const right = publicDisplayExpression(node.right, factory, filename);
    return left === node.left && right === node.right ? node
      : factory.updateBinaryExpression(node, left, node.operatorToken, right);
  }
  return node;
}

function staticTextExpression(node, factory, addKey, filename = '') {
  const literal = stringValue(node);
  if (literal !== null) {
    if (isCodeLike(literal)) return node;
    addKey(literal);
    return factory.createCallExpression(factory.createIdentifier('__ptEnglishText'), undefined, [
      factory.createStringLiteral(literal),
    ]);
  }
  if (ts.isTemplateExpression(node)) {
    const parts = [];
    let changed = false;
    const addLiteralPart = (text) => {
      if (!text) return;
      if (isCodeLike(text)) {
        parts.push(factory.createStringLiteral(text));
        return;
      }
      addKey(text);
      parts.push(factory.createCallExpression(factory.createIdentifier('__ptEnglishText'), undefined, [
        factory.createStringLiteral(text),
      ]));
      changed = true;
    };
    addLiteralPart(node.head.text);
    for (const span of node.templateSpans) {
      let expression = span.expression;
      if (isDynamicPublicText(expression, filename)) {
        expression = factory.createCallExpression(factory.createIdentifier('__ptEnglishText'), undefined, [expression]);
        changed = true;
      }
      parts.push(expression);
      addLiteralPart(span.literal.text);
    }
    if (!changed || !parts.length) return node;
    const spans = parts.map((expression, index) => factory.createTemplateSpan(
      expression,
      index === parts.length - 1
        ? factory.createTemplateTail('', '')
        : factory.createTemplateMiddle('', ''),
    ));
    return factory.updateTemplateExpression(node, factory.createTemplateHead('', ''), spans);
  }
  if (ts.isParenthesizedExpression(node)) {
    const inner = staticTextExpression(node.expression, factory, addKey, filename);
    return inner === node.expression ? node : factory.updateParenthesizedExpression(node, inner);
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = staticTextExpression(node.whenTrue, factory, addKey, filename);
    const whenFalse = staticTextExpression(node.whenFalse, factory, addKey, filename);
    if (whenTrue === node.whenTrue && whenFalse === node.whenFalse) return node;
    return factory.updateConditionalExpression(node, node.condition, node.questionToken, whenTrue, node.colonToken, whenFalse);
  }
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    const right = staticTextExpression(node.right, factory, addKey, filename);
    if (right === node.right) return node;
    return factory.updateBinaryExpression(node, node.left, node.operatorToken, right);
  }
  return node;
}

function hasStaticLiteral(node) {
  if (stringValue(node) !== null) return true;
  if (ts.isTemplateExpression(node)) return true;
  if (ts.isParenthesizedExpression(node)) return hasStaticLiteral(node.expression);
  if (ts.isConditionalExpression(node)) return hasStaticLiteral(node.whenTrue) || hasStaticLiteral(node.whenFalse);
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return hasStaticLiteral(node.right);
  return false;
}

function isUiErrorCall(node) {
  if (ts.isIdentifier(node)) return node.text === 'alert' || node.text === 'toast';
  if (!ts.isPropertyAccessExpression(node) || !TOAST_METHODS.has(node.name.text)) return false;
  let root = node.expression;
  while (ts.isPropertyAccessExpression(root)) root = root.expression;
  return ts.isIdentifier(root) && root.text === 'toast';
}

function safeErrorExpression(node, factory, addKey) {
  const literal = stringValue(node);
  if (literal !== null) {
    if (!humanErrorText(literal)) return node;
    addKey(literal);
    return factory.createCallExpression(factory.createIdentifier('__ptEnglishText'), undefined, [
      factory.createStringLiteral(literal),
    ]);
  }
  if (ts.isParenthesizedExpression(node)) {
    const inner = safeErrorExpression(node.expression, factory, addKey);
    return inner === node.expression ? node : factory.updateParenthesizedExpression(node, inner);
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = safeErrorExpression(node.whenTrue, factory, addKey);
    const whenFalse = safeErrorExpression(node.whenFalse, factory, addKey);
    if (whenTrue === node.whenTrue && whenFalse === node.whenFalse) return node;
    return factory.updateConditionalExpression(node, node.condition, node.questionToken, whenTrue, node.colonToken, whenFalse);
  }
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    const right = safeErrorExpression(node.right, factory, addKey);
    if (right === node.right) return node;
    return factory.updateBinaryExpression(node, node.left, node.operatorToken, right);
  }
  return node;
}

function makeCall(factory, name, args) {
  return factory.createCallExpression(factory.createIdentifier(name), undefined, args);
}

function safeJsxContent(node) {
  let parent = node.parent;
  while (parent) {
    if (ts.isJsxElement(parent)) {
      const tag = propertyName(parent.openingElement.tagName).toLowerCase();
      if (tag === 'textarea' || tag === 'script' || tag === 'style' || tag === 'pre' || tag === 'code') return false;
      if (tag === 'option' && !parent.openingElement.attributes.properties.some((attribute) =>
        ts.isJsxAttribute(attribute) && propertyName(attribute.name) === 'value')) return false;
    }
    parent = parent.parent;
  }
  return true;
}

function normalizedJsxText(raw) {
  if (!raw.includes('\n') && !raw.includes('\r')) return raw;
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ');
}

function rewrite(code, filename) {
  const id = normalizedPath(filename);
  const isGazetteApp = /\/artifacts\/pazartarla-gazete\/src\/App\.tsx$/.test(id)
    || /(?:^|\/)artifacts\/pazartarla-gazete\/src\/App\.tsx$/.test(id);
  const isGazetteApi = /\/artifacts\/pazartarla-gazete\/src\/lib\/gazette-api\.ts$/.test(id)
    || /(?:^|\/)artifacts\/pazartarla-gazete\/src\/lib\/gazette-api\.ts$/.test(id);
  const extension = id.slice(id.lastIndexOf('.') + 1);
  const scriptKind = extension === 'jsx' ? ts.ScriptKind.JSX
    : extension === 'tsx' ? ts.ScriptKind.TSX
      : extension === 'mjs' || extension === 'js' ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, scriptKind);
  const factory = ts.factory;
  const usedHelpers = new Set();
  const keys = new Set();
  const scope = projectScope(filename);
  const addKey = (key) => {
    if (typeof key === 'string' && key.trim() && !isCodeLike(key)) keys.add(key);
  };

  const visitor = (node) => {
    if(filename.endsWith('/DiscoveryBar.tsx')&&ts.isCallExpression(node)
      &&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='join'
      &&node.expression.expression.getText(source).includes('props.categories')){
      usedHelpers.add('translateUi');
      const translated=factory.createCallExpression(
        factory.createPropertyAccessExpression(ts.visitNode(node.expression.expression,visitor),'map'),
        undefined,[factory.createIdentifier('__ptEnglishText')]);
      return factory.updateCallExpression(node,factory.createPropertyAccessExpression(translated,'join'),
        node.typeArguments,node.arguments);
    }
    if(id.endsWith('/publicListingRequests.mjs')&&ts.isCallExpression(node)
      &&ts.isIdentifier(node.expression)&&node.expression.text==='request'&&node.arguments[0]){
      usedHelpers.add('englishApiUrl');
      return factory.updateCallExpression(node,node.expression,node.typeArguments,[
        factory.createCallExpression(factory.createIdentifier('__ptEnglishApiUrl'),undefined,[ts.visitNode(node.arguments[0],visitor)]),
        ...node.arguments.slice(1).map(arg=>ts.visitNode(arg,visitor)),
      ]);
    }
    if(ts.isPropertyAssignment(node)&&propertyName(node.name)==='label'
      && (ts.isStringLiteral(node.initializer)||ts.isNoSubstitutionTemplateLiteral(node.initializer))){
      addKey(node.initializer.text);
    }
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)
      && /^(?:categories|subCategories|categoryOptions|subCategoryOptions|menuItems|navItems|tabs|steps|filterOptions)$/i.test(node.name.text)
      && node.initializer&&ts.isArrayLiteralExpression(node.initializer)){
      for(const item of node.initializer.elements)if(ts.isStringLiteral(item))addKey(item.text);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'useEffect' && node.arguments[0]
      && (isGazetteApp || /\/(?:MarketAnalysisPage|AboutPage|AreaConverterPage|WeatherPage)\.tsx$/.test(id))
      && (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]))
      && node.arguments[0].getText(source).includes('document.title')) {
      usedHelpers.add('englishMetadataEffect');
      const callback=ts.visitEachChild(node.arguments[0],visitor,context);
      return factory.updateCallExpression(node,node.expression,node.typeArguments,[
        factory.createCallExpression(factory.createIdentifier('__ptEnglishMetadataEffect'),undefined,[callback]),
        ...node.arguments.slice(1).map(arg=>ts.visitNode(arg,visitor)),
      ]);
    }
    if (isGazetteApp && ts.isIfStatement(node) && isDirectDevFlag(node.expression, source)) {
      usedHelpers.add('englishActive');
      const condition = factory.createBinaryExpression(
        node.expression,
        factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
        factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,
          factory.createCallExpression(factory.createIdentifier('__ptEnglishActive'), undefined, [])),
      );
      node = factory.updateIfStatement(node, condition, node.thenStatement, node.elseStatement);
      return ts.visitEachChild(node, visitor, context);
    }

    if (isGazetteApp && ts.isConditionalExpression(node) && isDirectDevFlag(node.condition, source)) {
      usedHelpers.add('englishActive');
      const condition = factory.createBinaryExpression(
        node.condition,
        factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
        factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,
          factory.createCallExpression(factory.createIdentifier('__ptEnglishActive'), undefined, [])),
      );
      node = factory.updateConditionalExpression(node, condition, node.questionToken, node.whenTrue, node.colonToken, node.whenFalse);
      return ts.visitEachChild(node, visitor, context);
    }

    if ((isGazetteApi || extension === 'mjs')
      && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && humanErrorText(node.text)
      && (isErrorConstructorArgument(node)
        || (isGazetteApi && (isErrorMapValue(node) || isRequestMessageBranch(node))))) {
      addKey(node.text);
      usedHelpers.add('translateUi');
      return makeCall(factory, '__ptEnglishText', [factory.createStringLiteral(node.text)]);
    }

    if (ts.isJsxText(node)) {
      const raw = node.text;
      if(filename.endsWith('/BrandLogo.tsx')&&['Pazar','Tarla'].includes(raw.trim()))return node;
      if (!safeJsxContent(node)) return node;
      if (raw.includes('\n') || raw.includes('\r')) {
        const text = normalizedJsxText(raw);
        if (!text || isCodeLike(text)) return node;
        addKey(text);
        usedHelpers.add('translateUi');
        return factory.createJsxExpression(undefined,
          makeCall(factory, '__ptEnglishText', [factory.createStringLiteral(text)]));
      }
      if (!raw.trim()) return node;
      const leading = raw.match(/^\s*/)?.[0] || '';
      const trailing = raw.match(/\s*$/)?.[0] || '';
      const text = raw.slice(leading.length, raw.length - trailing.length);
      if (!text || isCodeLike(text)) return node;
      addKey(text);
      usedHelpers.add('translateUi');
      const result = [];
      if (leading) result.push(factory.createJsxText(leading, false));
      result.push(factory.createJsxExpression(undefined,
        makeCall(factory, '__ptEnglishText', [factory.createStringLiteral(text)])));
      if (trailing) result.push(factory.createJsxText(trailing, false));
      return result;
    }

    if (ts.isJsxExpression(node) && node.expression) {
      if (!ts.isJsxElement(node.parent) && !ts.isJsxFragment(node.parent)) return node;
      if (!safeJsxContent(node)) return node;
      let expression = node.expression;
      const publicText = publicDisplayExpression(expression, factory, filename);
      const priceLabel=['/MarketPricesBanner.tsx','/PriceNavigation.tsx'].some(name=>filename.endsWith(name))
        &&ts.isIdentifier(expression)&&expression.text==='label';
      const menuLabel=filename.endsWith('/HomeMenuDrawer.tsx')
        &&ts.isPropertyAccessExpression(expression)&&expression.name.text==='label'
        &&ts.isIdentifier(expression.expression)&&expression.expression.text==='item';
      const categoryLookup=scope==='gazette'&&ts.isPropertyAccessExpression(expression)
        &&expression.name.text==='label'&&ts.isCallExpression(expression.expression)
        &&ts.isPropertyAccessExpression(expression.expression.expression)
        &&expression.expression.expression.name.text==='find'
        &&ts.isIdentifier(expression.expression.expression.expression)
        &&expression.expression.expression.expression.text==='categories';
      const publicAlias = scope === 'gazette' && ts.isIdentifier(expression)
        && (expression.text === 'contentBody'
          || (expression.text === 'title' && ts.isJsxElement(node.parent)
            && propertyName(node.parent.openingElement.tagName).toLowerCase() === 'h1'));
      const uiLabel=isPublicConfigLabel(expression)||(ts.isPropertyAccessExpression(expression)&&expression.name.text==='label'
        &&ts.isIdentifier(expression.expression)&&UI_LABEL_ROOTS.has(expression.expression.text))
        ||(ts.isIdentifier(expression)&&UI_LABEL_ROOTS.has(expression.text));
      if (publicText !== expression) {
        usedHelpers.add('translateUi');
        expression = staticTextExpression(publicText,factory,addKey,filename);
      } else if (publicAlias||uiLabel||priceLabel||menuLabel||categoryLookup) {
        usedHelpers.add('translateUi');
        expression = makeCall(factory, '__ptEnglishText', [expression]);
      } else if (hasStaticLiteral(expression)) {
        const next = staticTextExpression(expression, factory, addKey, filename);
        if (next !== expression) {
          usedHelpers.add('translateUi');
          expression = next;
        }
      }
      const updated = expression === node.expression ? node : factory.updateJsxExpression(node, expression);
      return ts.visitEachChild(updated, visitor, context);
    }

    if (ts.isCallExpression(node)) {
      const isErrorMessage = isUiErrorCall(node.expression);
      if (isErrorMessage && node.arguments.length > 0) {
        const args = [...node.arguments];
        args[0] = safeErrorExpression(args[0], factory, addKey);
        if (args[0] !== node.arguments[0]) {
          usedHelpers.add('translateUi');
          node = factory.updateCallExpression(node, node.expression, node.typeArguments, args);
        }
      }
      const sourceRead = scope === 'marketplace'
        && ts.isIdentifier(node.expression)
        && new Set(['readPublicNavigation', 'listingIdFromUrl', 'isSupplierEntryUrl']).has(node.expression.text);
      if (sourceRead && node.arguments.length && /window\.location\.href/.test(node.arguments[0].getText(source))) {
        const args = [...node.arguments];
        args[0] = makeCall(factory, '__ptEnglishSourceUrl', [args[0]]);
        usedHelpers.add('englishSourceUrl');
        node = factory.updateCallExpression(node, node.expression, node.typeArguments, args);
      }
      const publicAssign = scope === 'marketplace'
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'assign'
        && node.expression.expression.getText(source) === 'window.location';
      if (publicAssign && node.arguments.length) {
        const args = [...node.arguments];
        const first = args[0];
        if (stringValue(first) !== null || ts.isTemplateExpression(first)) {
          args[0] = makeCall(factory, '__ptEnglishHref', [first, factory.createStringLiteral('marketplace')]);
          usedHelpers.add('englishHref');
          node = factory.updateCallExpression(node, node.expression, node.typeArguments, args);
        }
      }
      if (usesTurkishDisplayLocale(node.expression, 'toLocaleDateString')
        && node.arguments.length && ['tr-TR', 'tr'].includes(stringValue(node.arguments[0]))) {
        const args = [...node.arguments];
        args[0] = makeCall(factory, '__ptEnglishLocale', [factory.createStringLiteral(stringValue(args[0]))]);
        usedHelpers.add('englishLocale');
        node = factory.updateCallExpression(node, node.expression, node.typeArguments, args);
      } else if (usesTurkishDisplayLocale(node.expression)
        && node.arguments.length && ['tr-TR', 'tr'].includes(stringValue(node.arguments[0]))) {
        const args = [...node.arguments];
        args[0] = makeCall(factory, '__ptEnglishLocale', [factory.createStringLiteral(stringValue(args[0]))]);
        usedHelpers.add('englishLocale');
        node = factory.updateCallExpression(node, node.expression, node.typeArguments, args);
      }
      return ts.visitEachChild(node, visitor, context);
    }

    if (ts.isNewExpression(node) && usesTurkishDisplayLocale(node.expression)
      && node.arguments?.length && ['tr-TR', 'tr'].includes(stringValue(node.arguments[0]))) {
      const args = [...node.arguments];
      args[0] = makeCall(factory, '__ptEnglishLocale', [factory.createStringLiteral(stringValue(args[0]))]);
      usedHelpers.add('englishLocale');
      node = factory.updateNewExpression(node, node.expression, node.typeArguments, args);
      return ts.visitEachChild(node, visitor, context);
    }

    if (isGazetteApi && ts.isVariableDeclaration(node) && propertyName(node.name) === 'apiPath'
      && node.initializer && ts.isArrowFunction(node.initializer) && !ts.isBlock(node.initializer.body)) {
      usedHelpers.add('englishApiUrl');
      const initializer = factory.updateArrowFunction(node.initializer, node.initializer.modifiers,
        node.initializer.typeParameters, node.initializer.parameters, node.initializer.type,
        node.initializer.equalsGreaterThanToken,
        makeCall(factory, '__ptEnglishApiUrl', [node.initializer.body]));
      return factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, initializer);
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const attr = node.name.text;
      if (SAFE_ATTRIBUTES.has(attr) && node.initializer) {
        const value = ts.isStringLiteral(node.initializer) ? node.initializer.text : null;
        if (value !== null && value.trim() && !isCodeLike(value)) {
          addKey(value);
          usedHelpers.add('translateUi');
          const expression = makeCall(factory, '__ptEnglishText', [factory.createStringLiteral(value)]);
          return factory.updateJsxAttribute(node, node.name, factory.createJsxExpression(undefined, expression));
        }
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const original = node.initializer.expression;
          const translated = isDynamicPublicText(original, filename) ? makeCall(factory, '__ptEnglishText', [original])
            : hasStaticLiteral(original) ? staticTextExpression(original, factory, addKey, filename) : original;
          if (translated !== original) {
            usedHelpers.add('translateUi');
            return factory.updateJsxAttribute(node, node.name, factory.createJsxExpression(undefined, translated));
          }
        }
      }
      return ts.visitEachChild(node, visitor, context);
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = propertyName(node.tagName);
      const isLink = tag === 'Link';
      const isRouter = scope === 'gazette' && (tag === 'WouterRouter' || tag === 'Router');
      const attrs = node.attributes.properties.map((attribute) => ts.visitNode(attribute, visitor));
      let hrefAttr = null;
      let clickAttr = null;
      for (const attr of attrs) {
        if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name)) continue;
        if (attr.name.text === 'href') hrefAttr = attr;
        if (attr.name.text === 'onClick') clickAttr = attr;
      }
      if (hrefAttr?.initializer && !(isLink && scope === 'gazette')) {
        const oldValue = ts.isStringLiteral(hrefAttr.initializer)
          ? factory.createStringLiteral(hrefAttr.initializer.text)
          : ts.isJsxExpression(hrefAttr.initializer) && hrefAttr.initializer.expression
            ? hrefAttr.initializer.expression
            : null;
        if (oldValue) {
          usedHelpers.add('englishHref');
          const hrefExpression = makeCall(factory, '__ptEnglishHref', [
            oldValue,
            factory.createStringLiteral(scope),
          ]);
          const updated = factory.updateJsxAttribute(hrefAttr, hrefAttr.name,
            factory.createJsxExpression(undefined, hrefExpression));
          attrs[attrs.indexOf(hrefAttr)] = updated;
          hrefAttr = updated;
        }
      }
      if (isLink && hrefAttr && !attrs.some(ts.isJsxSpreadAttribute)) {
        let existingHandler = factory.createIdentifier('undefined');
        if (clickAttr?.initializer && ts.isJsxExpression(clickAttr.initializer) && clickAttr.initializer.expression) {
          existingHandler = clickAttr.initializer.expression;
        }
        const handler = makeCall(factory, '__ptEnglishClick', [existingHandler]);
        const updated = factory.createJsxAttribute(factory.createIdentifier('onClick'),
          factory.createJsxExpression(undefined, handler));
        if (clickAttr) attrs[attrs.indexOf(clickAttr)] = updated;
        else attrs.push(updated);
        usedHelpers.add('englishClick');
      }
      if (isRouter) {
        for (let i = 0; i < attrs.length; i += 1) {
          const attr = attrs[i];
          if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name) || !attr.initializer
            || !ts.isJsxExpression(attr.initializer) || !attr.initializer.expression) continue;
          const helper = attr.name.text === 'base'
            ? '__ptEnglishGazetteBase'
            : attr.name.text === 'hook' ? null : null;
          if (helper) {
            attrs[i] = factory.updateJsxAttribute(attr, attr.name,
              factory.createJsxExpression(undefined, makeCall(factory, helper, [attr.initializer.expression])));
            usedHelpers.add('englishGazetteBase');
          }
        }
      }
      const attributes = factory.updateJsxAttributes(node.attributes, attrs);
      return ts.isJsxOpeningElement(node)
        ? factory.updateJsxOpeningElement(node, node.tagName, node.typeArguments, attributes)
        : factory.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, attributes);
    }

    return ts.visitEachChild(node, visitor, context);
  };

  const context = ts.nullTransformationContext;
  const transformed = ts.visitNode(source, visitor);
  if (!usedHelpers.size) return { code, keys: [...keys] };
  const imports = [...usedHelpers].map((helper) => {
    const local = helper === 'translateUi' ? '__ptEnglishText'
      : helper === 'englishHref' ? '__ptEnglishHref'
        : helper === 'englishClick' ? '__ptEnglishClick'
          : helper === 'englishSourceUrl' ? '__ptEnglishSourceUrl'
            : helper === 'englishGazetteBase' ? '__ptEnglishGazetteBase'
              : helper === 'englishActive' ? '__ptEnglishActive'
                : helper === 'englishApiUrl' ? '__ptEnglishApiUrl'
                  : helper === 'englishLocale' ? '__ptEnglishLocale'
                    : helper === 'englishMetadataEffect' ? '__ptEnglishMetadataEffect'
                  : '__ptEnglishText';
    return factory.createImportSpecifier(false, factory.createIdentifier(helper), factory.createIdentifier(local));
  });
  const importDeclaration = factory.createImportDeclaration(undefined,
    factory.createImportClause(false, undefined, factory.createNamedImports(imports)),
    factory.createStringLiteral(VIRTUAL_ID), undefined);
  const printed = ts.factory.updateSourceFile(transformed, [importDeclaration, ...transformed.statements]);
  return { code: ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(printed), keys: [...keys] };
}

export function extractUiStrings(code, filename) {
  if (!supportedFile(filename)) return [];
  return rewrite(code, filename).keys;
}

export function englishUiPlugin({production=false,marketplaceRoot,gazetteRoot}={}) {
  const runtimePath = fileURLToPath(new URL('./browser-runtime.mjs', import.meta.url));
  const canonicalId=id=>{
    const filename=normalizedPath(id);
    for(const [root,prefix]of [[marketplaceRoot,'/external/pazartarla'],[gazetteRoot,'/artifacts/pazartarla-gazete']]){
      const directory=root&&normalizedPath(root).replace(/\/$/,'');
      if(directory&&filename.startsWith(directory+'/src/'))return prefix+filename.slice(directory.length);
    }
    return filename;
  };
  return {
    name: 'pazartarla-site-english-ui',
    apply: production?'build':'serve',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_ID) return runtimePath;
      return null;
    },
    transform(code, id) {
      const filename=canonicalId(id);
      if (!supportedFile(filename)) return null;
      const result = rewrite(code, filename);
      return result.code === code ? null : { code: result.code, map: null };
    },
  };
}
