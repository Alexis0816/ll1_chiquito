// Stack a mano (AED)
class Node {
    constructor(val) {
        this.val = val;
        this.next = null;
    }
}

class Stack {
    constructor() {
        this.head = null;
        this.nodes = 0;
    }

    // Constructor de copia
    copy(other) {
        if (other.head === null) {
            this.head = null;
            this.nodes = 0;
        } else {
            this.head = new Node(other.head.val);
            
            let current = this.head;
            let otherCurrent = other.head.next;
            
            while (otherCurrent) {
                current.next = new Node(otherCurrent.val);
                current = current.next;
                current.val = otherCurrent.val;
                otherCurrent = otherCurrent.next;
            }
            current.next = null;
            this.nodes = other.nodes;
        }
        return this;
    }
    
    size() {
        return this.nodes;
    }
    
    empty() {
        return !this.head;
    }
    
    top() {
        if (this.empty()) return null;
        return this.head.val;
    }
    
    push(x) {
        const newNode = new Node(x);
        if (this.empty()) {
            newNode.next = null;
        } else {
            newNode.next = this.head;
        }
        
        this.head = newNode;
        this.nodes++;
    }
    
    pop() {
        if (this.empty()) {
            console.log("Stack vacío");
        } else {
            const temp = this.head;
            this.head = this.head.next;
            this.nodes--;
            return temp.val;
        }
    }

    contains(val) {
        let current = this.head;
        while (current) {
            if (current.val === val) return true;
            current = current.next;
        }
        return false;
    }
    
    // para depurar
    toArray() {
        const result = [];
        let current = this.head;
        while (current) {
            result.push(current.val);
            current = current.next;
        }
        return result;
    }
}

// Estructura de gramática
class Grammar {
    constructor() {
        this.orderedProductions = []; // array de objetos {nonTerminal, productions}
        this.nonTerminals = new Set();
        this.terminals = new Set();
        this.startSymbol = '';
    }
}

// Funciones auxiliares
function trim(s) {
    return s.trim();
}

function split(s, delimiter) {
    const tokens = [];
    const parts = s.split(delimiter);
    for (const part of parts) {
        const trimmed = trim(part);
        if (trimmed.length > 0) {
            tokens.push(trimmed);
        }
    }
    return tokens;
}

// Carga una gramática desde un string (en c++ es desde un archivo c++)
function loadGrammar(grammarText) {
    const grammar = new Grammar();
    const lines = grammarText.split('\n');
    let first = true;

    // Mapa temporal que almacena producciones mientras procesamos
    const tempProductions = new Map();

    for (const line of lines) {
        const trimmedLine = trim(line);
        if (trimmedLine.length === 0) continue;

        // detecto flecha (→ o ->)
        let arrowPos = trimmedLine.indexOf("→");
        let delimiter = "→";
        if (arrowPos === -1) {
            arrowPos = trimmedLine.indexOf("->");
            delimiter = "->";
        }
        if (arrowPos === -1) continue;

        // se obtiene no terminal
        const nonTerminal = trim(trimmedLine.substring(0, arrowPos));
        grammar.nonTerminals.add(nonTerminal);
        if (first) {
            grammar.startSymbol = nonTerminal;
            first = false;
        }

        // otras producciones
        const productionStr = trim(trimmedLine.substring(arrowPos + delimiter.length));
        const alternatives = split(productionStr, '|');

        if (!tempProductions.has(nonTerminal)) {
            tempProductions.set(nonTerminal, []);
        }

        for (let alt of alternatives) {
            alt = trim(alt);
            const symbols = [];
            
            // Manejar ε o epsilon como un símbolo especial
            if (alt === "ε" || alt === "epsilon") {
                symbols.push("ε");
            } else {
                // Procesar símbolos individuales
                const syms = alt.split(/\s+/);
                for (const symbol of syms) {
                    if (symbol.length > 0) {
                        symbols.push(symbol);
                        
                        // Registrar terminales (solo si no es un no terminal y no es ε)
                        if (!grammar.nonTerminals.has(symbol) && 
                            symbol !== "ε" && symbol !== "epsilon") {
                            grammar.terminals.add(symbol);
                        }
                    }
                }
            }
            tempProductions.get(nonTerminal).push(symbols);
        }
    }
    
    // Limpiar terminales que puedan ser no terminales
    for (const nt of grammar.nonTerminals) {
        grammar.terminals.delete(nt);
    }
    
    // Añadir símbolos especiales si no están
    grammar.terminals.add("$");

    // Ordenar las producciones en orden jerárquico
    const stack = new Stack();
    const visited = new Set();
    stack.push(grammar.startSymbol);

    while (!stack.empty()) {
        const nt = stack.pop();

        if (visited.has(nt)) continue;
        visited.add(nt);

        // Agregar a las producciones ordenadas
        grammar.orderedProductions.push({ 
            nonTerminal: nt, 
            productions: tempProductions.get(nt) || [] 
        });

        // Procesar símbolos en orden inverso para mantener el orden correcto
        const tempStack = new Stack(); // Stack temporal para invertir el orden

        // Primero recolectamos todos los no terminales referenciados
        const prods = tempProductions.get(nt) || [];
        for (const prod of prods) {
            for (const sym of prod) {
                if (grammar.nonTerminals.has(sym) && !visited.has(sym) && !stack.contains(sym)) {
                    tempStack.push(sym);
                }
            }
        }

        // Transferir a la pila principal en orden inverso
        while (!tempStack.empty()) {
            stack.push(tempStack.pop());
        }
    }

    // Agregar cualquier no terminal no alcanzado
    for (const [nt, prods] of tempProductions.entries()) {
        if (!visited.has(nt)) {
            grammar.orderedProductions.push({ nonTerminal: nt, productions: prods });
        }
    }

    return grammar;
}

// Función auxiliar para unir los símbolos de una producción
function joinProduction(production) {
    return production.join(' ');
}

// Estructura para pasos de derivación
class DerivationStep {
    constructor() {
        this.stack = [];    // estado de la pila (['E', '$'])
        this.input = [];    // tokens pendientes (['id', '+', 'id', '$'])
        this.rule = '';     // qué regla se aplicó ("E → T E'")
    }
}

// Analizar con traza
function parseWithTrace(entrada, grammar) {
    const trace = [];
    const pila = new Stack();
    pila.push("$");
    pila.push(grammar.startSymbol);
    
    const initStep = new DerivationStep();
    initStep.stack = pila.toArray().reverse();
    initStep.input = [...entrada, "$"];
    initStep.rule = "Inicialización";
    trace.push(initStep);

    entrada.push("$");
    
    const table = buildLL1Table(grammar);
    const follow = computeFollow(grammar, computeFirst(grammar));
    
    while (!pila.empty()) {
        const step = new DerivationStep();
        step.stack = pila.toArray().reverse();
        step.input = [...entrada];
        
        const top = pila.top();
        const current = entrada[0] || "$";
        
        if (top === "$") {
            if (current === "$") {
                step.rule = "Aceptado";
                trace.push(step);
                break;
            } else {
                step.rule = "Rechazado: Fin inesperado";
                trace.push(step);
                break;
            }
        }
        
        if (grammar.terminals.has(top)) {
            if (top === current) {
                step.rule = "Match: " + top;
                trace.push(step);
                pila.pop();
                entrada.shift();
            } else {
                step.rule = `Error: Se esperaba '${top}', se encontró '${current}' (Explorar)`;
                trace.push(step);
                entrada.shift(); // Explorar: descartar terminal
            }
        } else if (grammar.nonTerminals.has(top)) {
            const action = table.get(top)?.get(current);
            
            if (!action) {
                step.rule = `Error: No hay acción definida para ${top} y ${current}`;
                trace.push(step);
                break;
            }

            if (action === "extract") {
                step.rule = `Extraer: ${top} (${current} ∈ FOLLOW(${top}))`;
                trace.push(step);
                pila.pop(); // Extraer el no terminal
            } else if (action === "explore") {
                step.rule = `Explorar: Descartar ${current} (no está en FIRST ni FOLLOW)`;
                trace.push(step);
                entrada.shift(); // Explorar: descartar terminal
            } else {
                step.rule = action;
                trace.push(step);
                
                pila.pop();
                const rhs = action.split(/→|->/)[1].trim();
                if (rhs !== "ε") {
                    const symbols = rhs.split(/\s+/).filter(s => s.length > 0);
                    for (let i = symbols.length - 1; i >= 0; i--) {
                        pila.push(symbols[i]);
                    }
                }
            }
        } else {
            step.rule = `Error: Símbolo desconocido '${top}'`;
            trace.push(step);
            break;
        }
    }
    
    return trace;
}

// Función auxiliar para padding
function padRight(str, length) {
    return str + " ".repeat(Math.max(0, length - str.length));
}

// Tokenizar la entrada
function tokenize(input, grammar) {
    const tokens = [];
    let current = '';
    
    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        if (/\s/.test(c)) {
            if (current.length > 0) {
                // Verificar si es un terminal válido
                if (grammar.terminals.has(current)) {
                    tokens.push(current);
                    current = '';
                } else {
                    // Verificar si parte del token es un terminal
                    let found = false;
                    for (const term of grammar.terminals) {
                        if (term.length > current.length && 
                            term.substring(0, current.length) === current) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        console.log(`Error: Token no reconocido '${current}'`);
                        return [];
                    }
                }
            }
        } else {
            current += c;
            // Verificar si el token actual es un terminal completo
            if (grammar.terminals.has(current)) {
                tokens.push(current);
                current = '';
            }
        }
    }
    
    if (current.length > 0) {
        if (grammar.terminals.has(current)) {
            tokens.push(current);
        } else {
            console.log(`Error: Token no reconocido al final '${current}'`);
            return [];
        }
    }
    
    return tokens;
}

// Calcular conjunto FIRST
function computeFirst(grammar) {
    const first = new Map();
    
    // Inicializar FIRST para terminales
    for (const term of grammar.terminals) {
        first.set(term, new Set([term]));
    }
    
    // Inicializar FIRST para no terminales
    for (const nt of grammar.nonTerminals) {
        first.set(nt, new Set());
    }
    
    let changed = true;
    while (changed) {
        changed = false;
        
        for (const prodPair of grammar.orderedProductions) {
            const nt = prodPair.nonTerminal;
            const prods = prodPair.productions;
            
            for (const prod of prods) {
                if (prod[0] === "ε") {
                    const size = first.get(nt).size;
                    first.get(nt).add("ε");
                    if (first.get(nt).size > size) {
                        changed = true;
                    }
                } else {
                    let allHaveEpsilon = true;
                    for (const sym of prod) {
                        // Agregar FIRST(sym) - {ε} a FIRST(nt)
                        const firstSym = first.get(sym);
                        if (!firstSym) continue;
                        
                        for (const f of firstSym) {
                            if (f !== "ε") {
                                const size = first.get(nt).size;
                                first.get(nt).add(f);
                                if (first.get(nt).size > size) {
                                    changed = true;
                                }
                            }
                        }
                        
                        if (!firstSym.has("ε")) {
                            allHaveEpsilon = false;
                            break;
                        }
                    }
                    
                    if (allHaveEpsilon) {
                        const size = first.get(nt).size;
                        first.get(nt).add("ε");
                        if (first.get(nt).size > size) {
                            changed = true;
                        }
                    }
                }
            }
        }
    }
    return first;
}

// Calcular conjunto FOLLOW
function computeFollow(grammar, first) {
    const follow = new Map();
    
    // Inicializar FOLLOW para todos los no terminales
    for (const nt of grammar.nonTerminals) {
        follow.set(nt, new Set());
    }
    follow.get(grammar.startSymbol).add("$");
    
    let changed = true;
    while (changed) {
        changed = false;
        
        for (const prodPair of grammar.orderedProductions) {
            const nt = prodPair.nonTerminal;
            const prods = prodPair.productions;
            
            for (const prod of prods) {
                for (let i = 0; i < prod.length; i++) {
                    const sym = prod[i];
                    if (grammar.nonTerminals.has(sym)) {
                        if (i + 1 < prod.length) {
                            const nextSym = prod[i + 1];
                            // Agregar FIRST(nextSym) - {ε} a FOLLOW(sym)
                            for (const f of first.get(nextSym)) {
                                if (f !== "ε") {
                                    const size = follow.get(sym).size;
                                    follow.get(sym).add(f);
                                    if (follow.get(sym).size > size) {
                                        changed = true;
                                    }
                                }
                            }
                            
                            // Si FIRST(nextSym) contiene ε, agregar FOLLOW(nt)
                            if (first.get(nextSym).has("ε")) {
                                for (const f of follow.get(nt)) {
                                    const size = follow.get(sym).size;
                                    follow.get(sym).add(f);
                                    if (follow.get(sym).size > size) {
                                        changed = true;
                                    }
                                }
                            }
                        } else {
                            // Agregar FOLLOW(nt) a FOLLOW(sym)
                            for (const f of follow.get(nt)) {
                                const size = follow.get(sym).size;
                                follow.get(sym).add(f);
                                if (follow.get(sym).size > size) {
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return follow;
}

// Construir tabla LL(1)
function buildLL1Table(grammar) {
    const first = computeFirst(grammar);
    const follow = computeFollow(grammar, first);
    const table = new Map();
    const allTerminals = [...grammar.terminals, '$'];

    for (const nt of grammar.nonTerminals) {
        table.set(nt, new Map());
        
        // Primero marcamos todas las entradas como "explore" por defecto
        for (const term of allTerminals) {
            table.get(nt).set(term, "explore");
        }
        
        // Luego llenamos las producciones válidas
        for (const prod of grammar.orderedProductions.find(p => p.nonTerminal === nt).productions) {
            const productionStr = `${nt} -> ${joinProduction(prod)}`;
            const firstSet = new Set();
            
            if (prod[0] === "ε") {
                // Para ε, usar FOLLOW
                for (const f of follow.get(nt)) {
                    table.get(nt).set(f, productionStr);
                }
            } else {
                let hasEpsilon = true;
                for (const sym of prod) {
                    for (const f of first.get(sym)) {
                        if (f !== "ε") {
                            firstSet.add(f);
                        }
                    }
                    if (!first.get(sym).has("ε")) {
                        hasEpsilon = false;
                        break;
                    }
                }
                
                for (const f of firstSet) {
                    table.get(nt).set(f, productionStr);
                }
                
                if (hasEpsilon) {
                    for (const f of follow.get(nt)) {
                        table.get(nt).set(f, productionStr);
                    }
                }
            }
        }
        
        // Finalmente marcamos los FOLLOW como "extract"
        for (const term of follow.get(nt)) {
            if (table.get(nt).get(term) === "explore") {
                table.get(nt).set(term, "extract");
            }
        }
    }
    
    return table;
}

function analyze(grammarText, input) {
    try {
        // cargar gramática
        const grammar = loadGrammar(grammarText);
        
        if (grammar.orderedProductions.length === 0) {
            return "Error: Gramática no válida o vacía";
        }
        
        // Tokenizar entrada
        const tokens = tokenize(input, grammar);
        if (tokens.length === 0) {
            return ">> Expresión contiene errores";
        }
        
        // Realizar análisis
        const trace = parseWithTrace(tokens, grammar);
        
        // Formatear tabla de derivación
        let output = "";
        output += "+----------------------------+-----------------------------------+--------------------------------+\n";
        output += "| PILA                       | ENTRADA                           | ACCIÓN                         |\n";
        output += "+----------------------------+-----------------------------------+--------------------------------+\n";
        
        for (const step of trace) {
            const stack = step.stack.join(" ");
            const input = step.input.join(" ");
            const action = step.rule;
            
            output += `| ${padRight(stack, 26)} | ${padRight(input, 33)} | ${padRight(action, 30)} |\n`;
        }
        output += "+----------------------------+-----------------------------------+--------------------------------+\n";
        
        return output;
    } catch (e) {
        return `Error crítico: ${e.message}`;
    }
}

// Exportar funciones para uso desde HTML
if (typeof module !== 'undefined') {
    module.exports = {
        Stack,
        Grammar,
        loadGrammar,
        parseWithTrace,
        computeFirst,
        computeFollow,
        buildLL1Table,
        analyze
    };
}