export class StCss {

    protected readonly cache: Map<string, string> = new Map();
    protected readonly sheet!: CSSStyleSheet;
    protected readonly rules: string[][];

    constructor(readonly config: StCssConfig) {
        this.rules = [0,...config.breakpoints].map(() => []);
        if (typeof document !== 'undefined') {
            this.sheet = document.head.appendChild(document.createElement('style')).sheet as CSSStyleSheet;
            this.config.breakpoints.forEach(bp => {
                this.sheet.insertRule(`@media screen and (min-width: ${bp}) {}`, this.sheet.cssRules.length);
            });
        }
    }

    protected onNewRule(rule: StCssRule, className: string, bp: number) {
        const ruleString = `.${className}${rule[2]}{${rule[0].replace(/[A-Z]/g, '-$&').toLowerCase()}:${rule[1]}}`;
        this.rules[bp].push(ruleString);
        if (typeof document !== 'undefined') {
            if (bp > 0){
                const sheet = this.sheet.cssRules[this.sheet.cssRules.length - this.config.breakpoints.length - 1 + bp] as CSSMediaRule; 
                sheet.insertRule(ruleString, sheet.cssRules.length);
            }
            else {
                this.sheet.insertRule(ruleString, this.sheet.cssRules.length - this.config.breakpoints.length);
            }
        }
    }

    protected className(rule: StCssRule, bp = 0): string {
        let rules: StCssRules = [rule];
        for (const t of this.config.transformers || []){
            const r = t(rule, bp);
            if (r){
                rules = ([] as StCssRules).concat(r);
                break;
            }
        }
        return rules.map(r => {
            const hash = r.join() + bp;
            const cachedClassName = this.cache.get(hash);
            if (cachedClassName) return cachedClassName;
            const className = `st-${this.cache.size.toString(36)}`;
            this.onNewRule(r, className, bp);
            this.cache.set(hash, className);
            return className;
        }).join(' ');
    }

    mergeRules = (...ruleSets: StCssRules[]): StCssRules => {
        const map = new Map<string, StCssRule>();
        ruleSets.filter(r => r).forEach(rules => rules.forEach((r => map.set(r[2]+r[0], r))));
        return Array.from(map.values());
    }

    extractRulesByBp = (styleObj: Styles, prefix = '', result?: StCssRules[]): StCssRules[] => {
        return Object.keys(styleObj || {}).reduce((acc, k) => {
          if (typeof styleObj[k] === 'object') {
            if (Array.isArray(styleObj[k])){
                (styleObj[k] as StyleValue[]).forEach((v, i) => acc[i].push([k, v, prefix]))
            }
            else {
                this.extractRulesByBp(styleObj[k] as Styles, prefix + k, acc);
            }
          } else {
            acc[0].push([k, styleObj[k] as StyleValue, prefix]);
          }
          return acc;
        }, result || [0, ...this.config.breakpoints].map(_ =>[]) as StCssRules[]);
    }
    
    st = (...styles: (Styles | StCssRules[])[]): string => {
        const ruleSets = styles.map(s => Array.isArray(s) ? s : this.extractRulesByBp(s));
        return [0, ...this.config.breakpoints].map((_, i) => {
            return this.mergeRules(...ruleSets.map(rs => rs[i])).map(rule => this.className(rule, i)).join(' ');
        }).join(' ')
    }

    canonize = (C: any) => (...styles: (Styles | StCssRules[] | ((props: any, stcss: StCss) => Styles | StCssRules[]))[]) => {
        const Component: StFuncComp = (props) => {
            const { className = '', css = {}, as, ...newProps } = props;
            Component.st_classes = this.st(...styles.map(s => typeof s === 'function' ? s(props, this) : s), css) + ' ' + (C.st_classes || '');
            newProps.className = `${className} ${Component.st_classes}`.trim();
            return this.config.pragma(as || C, newProps);
        }
        return Component;
    }

    toString(): string {
        let str = this.rules[0].sort().join('');
        this.config.breakpoints.forEach((bp, i) => {
            str += `@media screen and (min-width: ${bp}) { ${this.rules[i+1].sort().join('') }}`;
        });
        return str;
    }
}