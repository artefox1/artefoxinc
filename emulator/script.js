const state = {
    regs: new Uint8Array(8),
    mem: new Uint8Array(64),
    stack: new Uint16Array(16),
    sp: 0, pc: 0,
    flags: { C: 0, N: 0, Z: 0 },
    rom: new Uint16Array(2048),
    lineMap: {}, labels: {}, constants: {},
    lineToAsm: {},
    gutterMode: 'line',
    isRunning: false,
    viewMode: 'hex',
    unlimitedHz: false,
    instructionsRun: 0,
    lastHzUpdate: 0,
    trigPort: 63,
    inputs: new Uint8Array(4),
    padValue: 0,
    vram: new Uint8Array(128 * 128),
    backBuffer: new Uint8Array(128 * 128),
    doubleBuffered: false,
    pushPort: 62,
    dispResX: 128,
    dispResY: 128,
    dispMode: 'mono',
    mono2x2: false,
    startX: 0,
    startY: 0,
    decX: false,
    decY: false,
    bitMaps: Array.from({length: 4}, () => Array.from({length: 8}, () => ({ type: 'none', sig: 0 }))),
    textures: { off: new Image(), on: new Image() },
    palette: ["#000000","#111111","#222222","#333333","#444444","#555555","#666666","#777777",
              "#888888","#999999","#aaaaaa","#bbbbbb","#cccccc","#dddddd","#eeeeee","#ffffff"]
};

const PRESETS = {
    default: {
        code: `# draws pixel at (4, 3)\nldi r1 4\nldi r2 60\nmst r1 r2 # x\n\nldi r1 3\nldi r2 61\nmst r1 r2 # y\n\nldi r2 63\nmst r0 r2 # plot\nhlt`,
        resX: 24, resY: 12, mode: 'mono', unlimited: false, trig: 63, push: 62, buffer: false, m2x2: true,
        palette: ["#000000","#111111","#222222","#333333","#444444","#555555","#666666","#777777","#888888","#999999","#aaaaaa","#bbbbbb","#cccccc","#dddddd","#eeeeee","#ffffff"],
        mapX: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7]],
        mapY: [[1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],[1,7]],
        mapC: []
    },
    mandelbrot: {
        code: `# Copyright © 2026 artefox\n\ndefine port0 0x3c\ndefine port1 0x3d\ndefine port2 0x3e\ndefine port3 0x3f\n\n# memory map:\n# real, imag: 4, 5\n# x, y: 7:6, 9:8\n# x2, y2: 11:10, 13:12\n# iterations, imag_loop, real_loop: 16, 17, 18\ndefine real    0b000100\ndefine imag    0b000101\ndefine xh      0b000111\ndefine xl      0b000110\ndefine yh      0b001001\ndefine yl      0b001000\ndefine x2h     0b001011\ndefine x2l     0b001010\ndefine y2h     0b001101\ndefine y2l     0b001100\ndefine iter    0b010000\ndefine im_loop 0b010001\ndefine re_loop 0b010010\n\n# TONE MAP - CONVERT 1-24 TO 0-15 - DONE IN HARDWARE IN MC - MODIFIED FOR EMULATOR\ndefine c00 15\ndefine c01 14\ndefine c02 14\ndefine c03 13\ndefine c04 13\ndefine c05 12\ndefine c06 12\ndefine c07 11\ndefine c08 11\ndefine c09 10\ndefine c10 10\ndefine c11 9\ndefine c12 9\ndefine c13 8\ndefine c14 8\ndefine c15 7\ndefine c16 6\ndefine c17 5\ndefine c18 4\ndefine c19 3\ndefine c20 2\ndefine c21 1\ndefine c22 0\ndefine c23 0 # UNSEEN\ndefine c24 0 # UNSEEN\n\njmp start\n\n# product in r7:r6:r5, unsigned in 000003:000002:000001, uses 000000\n# does not reset product memory!\n@signed_multiply_16\n# A: r2:r1 (little endian)\n# B: r4:r3\n# C: r7:r6:r5 (no one cares about higher byte)\n\n# get absolute values of inputs\n# store sign in 0b000000\nldi r5 0x00 # sign register\nldi r6 0x01 # one\nldi r7 0b000000 # address\n\nadi r2 0x00 # test if A is negative\nbps a_skip_abs\nxor r5 r5 r6 # xor with 1\nsub r1 r0 r1 # subtract and extend if negative\nsbb r2 r0 r2\n@a_skip_abs\n\nadi r4 0x00\nbps b_skip_abs\nxor r5 r5 r6\nsub r3 r0 r3\nsbb r4 r0 r4\n@b_skip_abs\n\nmst r5 r7 # store sign (1 if negative)\n\n# if lsb of B = 1, add A, then lsh A and rsh B\n# A needs 3 bytes\n# store product in 000003:000002:000001\n# r7 = iterations, r6 = 1\n# C = r7:r6:r5 (temporarily hijack then go back into memory)\n# A = r3:r2:r1\n# B = r5:r4\nmov r5 r4\nmov r4 r3 # move up B\nldi r3 0x00\n\nldi r7 16\n@mult_loop\n\n# test B lsb\nand r0 r4 r6\nbeq skip_add\n# add if not zero\npsh r7 # temp store B, loop to load product\npsh r6\npsh r5\npsh r4 # temp address\nldi r4 0b000001\nmld r5 r4\nadi r4 0x01\nmld r6 r4\nadi r4 0x01\nmld r7 r4\n\nadd r5 r5 r1\nadc r6 r6 r2\nadc r7 r7 r3\n\n# store product and recover values\nmst r7 r4\nadi r4 0xFF # subtract now\nmst r6 r4\nadi r4 0xFF\nmst r5 r4\npop r4\npop r5\npop r6\npop r7\n\n@skip_add\n# lsh A and rsh B, then dec loop\nadd r1 r1 r1\nadc r2 r2 r2\nadc r3 r3 r3\n\n# rsh with carry\nrsh r4 r4\nand r0 r5 r6 # test B lsb\nbeq skip_ror\nadi r4 0x80\n@skip_ror\nrsh r5 r5\n\nadi r7 0xFF # decrement loop\nbne mult_loop # loop if still not zero\n\n# load product\nldi r4 0b000001\nmld r5 r4\nadi r4 0x01\nmld r6 r4\nadi r4 0x01\nmld r7 r4\n\n# load sign to see if negate product\nldi r4 0b000000\nmld r3 r4 # load sign into r3\nadd r0 r3 r0 # test sign\nbeq skip_negate\n\nsub r5 r0 r5\nsbb r6 r0 r6\nsbb r7 r0 r7\n\n@skip_negate\nret\n\n@start\n# start at 0b10011000,0b10111010 (real, imag) but real + 6 for aesthetics\n# step by 3\n# imag is 18 loops, real is 35, iter is 24\nldi r1 im_loop # reset imag\nldi r2 23\nmst r2 r1\n\nldi r1 imag\nldi r2 0b10111010\nmst r2 r1\n\n@imag_loop\nldi r1 re_loop # reset real at start of every imag loop\nldi r2 45\nmst r2 r1\n\nldi r1 real\nldi r2 0b10011110\nmst r2 r1\n\n@real_loop\n# mandelbrot here\nldi r1 iter\nldi r2 24\nmst r2 r1\n\n# reset x, y\nldi r1 xh\nmst r0 r1\nldi r1 xl\nmst r0 r1\nldi r1 yh\nmst r0 r1\nldi r1 yl\nmst r0 r1\n\n@iterations\n# get x^2 y^2 xy products\nldi r1 0b000001 # reset product\nmst r0 r1\nadi r1 0x01\nmst r0 r1\nadi r1 0x01\nmst r0 r1\n# load A B with x\nldi r7 xh\nmld r2 r7\nmov r4 r2\nldi r7 xl\nmld r1 r7\nmov r3 r1\ncal signed_multiply_16 # we care about r7:r6\nldi r5 x2h\nmst r7 r5\nldi r5 x2l\nmst r6 r5 # store x^2\n\nldi r1 0b000001 # reset product\nmst r0 r1\nadi r1 0x01\nmst r0 r1\nadi r1 0x01\nmst r0 r1\n\nldi r7 yh\nmld r2 r7\nmov r4 r2\nldi r7 yl\nmld r1 r7\nmov r3 r1\ncal signed_multiply_16\nldi r5 y2h\nmst r7 r5\nldi r5 y2l\nmst r6 r5 # store y^2\n\n# test if break (x^2 + y^2 >= 4)\n# y2 is in r7:r6 already\n# get x2 in r5:r4\nldi r3 x2h\nmld r5 r3\nldi r3 x2l\nmld r4 r3\n\n# add them to r3:r2\nadd r2 r4 r6\nadc r3 r5 r7\n\n# compare to 4 (0b00000100.00000000)\nldi r1 0x04\nsub r0 r3 r1 # if high - 4 >= 0, then l >= 4\nbps break\n\n# do xy\nldi r1 0b000001 # reset product\nmst r0 r1\nadi r1 0x01\nmst r0 r1\nadi r1 0x01\nmst r0 r1\n\nldi r7 xh\nmld r2 r7\nldi r7 xl\nmld r1 r7\nldi r7 yh\nmld r4 r7\nldi r7 yl\nmld r3 r7\ncal signed_multiply_16 # dont needa store xy use it instantly\n\n# do 2xy + imag first to avoid storing xy\n# lsh xy (already 8.8 sign extended)\nadd r6 r6 r6\nadc r7 r7 r7\n\n# load imag to r4 and lsh 2 into r5 to be 8.8\nldi r4 imag\nmld r4 r4\nldi r5 0x00 # make sure h is 0\nadd r4 r4 r4 # if this goes into carry, sign extend\nblt skip_imag_sign # skip if not\nadi r5 0xFF\n@skip_imag_sign\nadd r4 r4 r4\nadc r5 r5 r5 # then do normally already sign extended\n\n# 2xy is r7:r6 and imag is r5:r4, add to r7:r6\nadd r6 r4 r6\nadc r7 r5 r7 # newy is now in r7:r6, and can store it bc no use for y\n# store new y into y\nldi r5 yh\nmst r7 r5\nldi r5 yl\nmst r6 r5\n\n# do x2 - y2 + real, put it in x\n# put x2 into r5:r4 and y2 into r7:r6\nldi r3 x2h\nmld r5 r3\nldi r3 x2l\nmld r4 r3\nldi r3 y2h\nmld r7 r3\nldi r3 y2l\nmld r6 r3\n\n# do x2 - y2 put into r7:r6\nsub r6 r4 r6\nsbb r7 r5 r7\n\n# load real into r4 and lsh 2 into r5\nldi r4 real\nmld r4 r4\nldi r5 0x00\nadd r4 r4 r4\nblt skip_real_sign\nadi r5 0xFF\n@skip_real_sign\nadd r4 r4 r4\nadc r5 r5 r5\n\n# add real to x2 - y2\nadd r6 r4 r6\nadc r7 r5 r7\n# store x\nldi r5 xh\nmst r7 r5\nldi r5 xl\nmst r6 r5\n\nldi r1 iter\nmld r2 r1\nadi r2 0xFF\nmst r2 r1\nbne iterations\n# END OF ITERATION LOOP\n@break\n# output re_loop, im_loop, and iter to p0, p1, p2\n# gotta output 45 - re_loop and 23 - im_loop\nldi r1 re_loop\nmld r2 r1\nldi r3 45\nsub r2 r3 r2\nldi r1 port0\nmst r2 r1\n\n# 22 - y\nldi r1 im_loop\nmld r2 r1\nldi r3 23\nsub r2 r3 r2\nldi r1 port1\nmst r2 r1\n\nldi r4 iter\nmld r5 r4\n\n# VALUE 1-24 IN R5, CONVERT TO 0-15 FOR DISPLAY (DONE IN HARDWARE IN MC - MODIFIED FOR EMULATOR)\nldi r7 0 # test against\nsub r0 r5 r7\nbne T0\nldi r5 c00\njmp T_END\n@T0\nadi r7 1\nsub r0 r5 r7\nbne T1\nldi r5 c01\njmp T_END\n@T1\nadi r7 1\nsub r0 r5 r7\nbne T2\nldi r5 c02\njmp T_END\n@T2\nadi r7 1\nsub r0 r5 r7\nbne T3\nldi r5 c03\njmp T_END\n@T3\nadi r7 1\nsub r0 r5 r7\nbne T4\nldi r5 c04\njmp T_END\n@T4\nadi r7 1\nsub r0 r5 r7\nbne T5\nldi r5 c05\njmp T_END\n@T5\nadi r7 1\nsub r0 r5 r7\nbne T6\nldi r5 c06\njmp T_END\n@T6\nadi r7 1\nsub r0 r5 r7\nbne T7\nldi r5 c07\njmp T_END\n@T7\nadi r7 1\nsub r0 r5 r7\nbne T8\nldi r5 c08\njmp T_END\n@T8\nadi r7 1\nsub r0 r5 r7\nbne T9\nldi r5 c09\njmp T_END\n@T9\nadi r7 1\nsub r0 r5 r7\nbne T10\nldi r5 c10\njmp T_END\n@T10\nadi r7 1\nsub r0 r5 r7\nbne T11\nldi r5 c11\njmp T_END\n@T11\nadi r7 1\nsub r0 r5 r7\nbne T12\nldi r5 c12\njmp T_END\n@T12\nadi r7 1\nsub r0 r5 r7\nbne T13\nldi r5 c13\njmp T_END\n@T13\nadi r7 1\nsub r0 r5 r7\nbne T14\nldi r5 c14\njmp T_END\n@T14\nadi r7 1\nsub r0 r5 r7\nbne T15\nldi r5 c15\njmp T_END\n@T15\nadi r7 1\nsub r0 r5 r7\nbne T16\nldi r5 c16\njmp T_END\n@T16\nadi r7 1\nsub r0 r5 r7\nbne T17\nldi r5 c17\njmp T_END\n@T17\nadi r7 1\nsub r0 r5 r7\nbne T18\nldi r5 c18\njmp T_END\n@T18\nadi r7 1\nsub r0 r5 r7\nbne T19\nldi r5 c19\njmp T_END\n@T19\nadi r7 1\nsub r0 r5 r7\nbne T20\nldi r5 c20\njmp T_END\n@T20\nadi r7 1\nsub r0 r5 r7\nbne T21\nldi r5 c21\njmp T_END\n@T21\nadi r7 1\nsub r0 r5 r7\nbne T22\nldi r5 c22\njmp T_END\n@T22\nadi r7 1\nsub r0 r5 r7\nbne T23\nldi r5 c23\njmp T_END\n@T23\nadi r7 1\nsub r0 r5 r7\nbne T24\nldi r5 c24\njmp T_END\n@T24\nldi r5 12\n@T_END\n\nldi r4 port2\nmst r5 r4\n# write\nldi r7 0x3F\nmst r0 r7\n\n# flip and plot again\n# 22 - (22 - y) + 21 = y + 21\nsub r2 r3 r2\nadi r2 21\nmst r2 r1\nmst r5 r4\n# write\nldi r7 0x3F\nmst r0 r7\n\nldi r1 real # add 3 to real\nmld r2 r1\nadi r2 0x03\nmst r2 r1\n\nldi r1 re_loop\nmld r2 r1\nadi r2 0xFF\nmst r2 r1\nbne real_loop \n# END OF REAL LOOP\n\nldi r1 imag # add 3 to imag\nmld r2 r1\nadi r2 0x03\nmst r2 r1\n\nldi r1 im_loop\nmld r2 r1\nadi r2 0xFF\nmst r2 r1\nbne imag_loop \n# END OF IMAG LOOP\n\nhlt`,
        resX: 45, resY: 45, mode: 'color', unlimited: true, trig: 63, push: 60, buffer: false, m2x2: false,
        palette: ["#000000", "#0f111a", "#1e2233", "#2d334d", "#3c4466", "#4b5580", "#5a6699", "#6977b3", "#7888cc", "#8799e6", "#96aaff", "#a5bbff", "#b4ccff", "#c3ddff", "#d2eeff", "#ffffff"],
        mapX: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]],
        mapY: [[1,0],[1,1],[1,2],[1,3],[1,4],[1,5]],
        mapC: [[2,0],[2,1],[2,2],[2,3]]
    },
    graph: {
        code: `wip`,
        resX: 64, resY: 64, mode: 'mono', unlimited: true, trig: 63, push: 62, buffer: false, m2x2: false,
        palette: ["#000000","#111111","#222222","#333333","#444444","#555555","#666666","#777777","#888888","#999999","#aaaaaa","#bbbbbb","#cccccc","#dddddd","#eeeeee","#ffffff"],
        mapX: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]],
        mapY: [[1,0],[1,1],[1,2],[1,3],[1,4],[1,5]],
        mapC: []
    }
};

const OP = {
    nop: 0x0000, hlt: 0x0800, add: 0x1000, adc: 0x1800, adi: 0x2000,
    sub: 0x2800, sbb: 0x3000, and: 0x3800, bor: 0x4000, nor: 0x4800,
    xor: 0x5000, rsh: 0x5800, ash: 0x6000, mov: 0x6800, ldi: 0x7000,
    jmp: 0x7800, bge: 0x8000, blt: 0x8800, bng: 0x9000, bps: 0x9800,
    beq: 0xA000, bne: 0xA800, mld: 0xB000, mst: 0xB800, psh: 0xC000,
    pop: 0xC800, cal: 0xD000, ret: 0xD800
};

const $ = s => document.querySelector(s);

/* ---------- status helper ---------- */
function setStatus(text, stateName = '') {
    const s = $('#status-bar');
    s.textContent = text;
    s.dataset.state = stateName;
}

/* ---------- syntax highlighting ---------- */
const OPCODES = Object.keys(OP);
function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function hlLine(line) {
    let out = '', last = 0, m;
    const re = /(#.*|;.*)|(@[A-Za-z_]\w*)|\b(0x[0-9a-fA-F]+|0b[01]+|\d+)\b|\b([rR][0-7])\b|([A-Za-z_]\w*)/g;
    while ((m = re.exec(line))) {
        out += escHtml(line.slice(last, m.index));
        if (m[1]) out += `<span class="tok-comment">${escHtml(m[1])}</span>`;
        else if (m[2]) out += `<span class="tok-label">${escHtml(m[2])}</span>`;
        else if (m[3]) out += `<span class="tok-num">${escHtml(m[3])}</span>`;
        else if (m[4]) out += `<span class="tok-reg">${escHtml(m[4])}</span>`;
        else if (m[5]) {
            const w = m[5], lw = w.toLowerCase();
            if (lw === 'define') out += `<span class="tok-define">${escHtml(w)}</span>`;
            else if (OPCODES.includes(lw)) out += `<span class="tok-op">${escHtml(w)}</span>`;
            else out += `<span class="tok-const">${escHtml(w)}</span>`;
        }
        last = m.index + m[0].length;
    }
    out += escHtml(line.slice(last));
    return out;
}
function highlightCode() {
    const code = $('#editor').value;
    $('#highlight code').innerHTML = code.split('\n').map(hlLine).join('\n') + '\n';
    updateGutter();
    syncScroll();
}
function updateGutter() {
    // active line only shown while running
    const active = state.isRunning ? state.lineMap[state.pc] : -1;
    const count = $('#editor').value.split('\n').length;
    let html = '';
    for (let i = 0; i < count; i++) {
        let label;
        if (state.gutterMode === 'asm') {
            // only real assembled instructions get a number (1-based);
            // comments / labels / defines / blank lines stay unnumbered
            label = (state.lineToAsm[i] !== undefined) ? (state.lineToAsm[i] + 1) : '';
        } else {
            label = i + 1;
        }
        html += `<div class="${i === active ? 'active' : ''}">${label}</div>`;
    }
    $('#gutter').innerHTML = html;
}
function positionActiveLine() {
    const el = $('#active-line');
    const active = state.lineMap[state.pc];
    // highlighted line only appears while the program is running
    if (!state.isRunning || active === undefined) { el.style.display = 'none'; return; }
    const cs = getComputedStyle(document.documentElement);
    const lh = parseFloat(cs.getPropertyValue('--code-line'));
    const pad = parseFloat(cs.getPropertyValue('--code-pad-y'));
    const ed = $('#editor');

    // keep the active line vertically centred in the viewport,
    // clamped so we never scroll past the top or bottom of the text
    const centreTarget = pad + active * lh - (ed.clientHeight / 2 - lh / 2);
    const maxScroll = Math.max(0, ed.scrollHeight - ed.clientHeight);
    const scrollTop = Math.max(0, Math.min(maxScroll, centreTarget));
    ed.scrollTop = scrollTop;
    $('#highlight').scrollTop = scrollTop;
    $('#gutter').scrollTop = scrollTop;

    const top = pad + active * lh - scrollTop;
    el.style.display = 'block';
    el.style.transform = `translateY(${top}px)`;
}
function syncScroll() {
    const ed = $('#editor');
    $('#highlight').scrollTop = ed.scrollTop;
    $('#highlight').scrollLeft = ed.scrollLeft;
    $('#gutter').scrollTop = ed.scrollTop;
    positionActiveLine();
}

function assemble() {
    const lines = $('#editor').value.split('\n');
    state.rom.fill(0);
    state.labels = {};
    state.constants = {};
    state.lineMap = {};
    state.lineToAsm = {};
    let pc = 0;
    const program = [];

    for (let i = 0; i < lines.length; i++) {
        let code = lines[i].split(/[#;]/)[0].trim();
        if (!code) continue;
        const parts = code.toLowerCase().split(/\s+/);
        if (parts[0] === 'define') {
            if (parts.length < 3) return reportError("Invalid define syntax", i);
            const name = parts[1];
            const rawVal = parts[2];
            let val;
            if (rawVal.startsWith('0x')) val = parseInt(rawVal.slice(2), 16);
            else if (rawVal.startsWith('0b')) val = parseInt(rawVal.slice(2), 2);
            else val = parseInt(rawVal);
            if (isNaN(val)) return reportError(`Invalid constant value: ${rawVal}`, i);
            state.constants[name] = val;
            continue;
        }
        if (code.startsWith('@')) {
            const label = code.split(/\s+/)[0].toLowerCase();
            state.labels[label] = pc;
            code = code.substring(label.length).trim();
            if (!code) continue;
        }
        program.push({ code, lineIdx: i, pc: pc++ });
    }

    program.forEach(item => { state.lineToAsm[item.lineIdx] = item.pc; });

    for (const item of program) {
        const parts = item.code.toLowerCase().split(/\s+/);
        const mnemonic = parts[0];
        const args = parts.slice(1);
        if (!OP.hasOwnProperty(mnemonic)) return reportError(`Unknown opcode ${mnemonic}`, item.lineIdx);
        let bin = OP[mnemonic];
        const getReg = r => parseInt(r[1]);
        const getVal = (v, bits) => {
            let val;
            if (state.constants[v] !== undefined) val = state.constants[v];
            else if (state.labels[v] !== undefined) val = state.labels[v];
            else if (state.labels['@' + v] !== undefined) val = state.labels['@' + v];
            else if (v.startsWith('0x')) val = parseInt(v.slice(2), 16);
            else if (v.startsWith('0b')) val = parseInt(v.slice(2), 2);
            else val = parseInt(v);
            if (isNaN(val)) throw new Error(`Unknown symbol: ${v}`);
            return val & ((1 << bits) - 1);
        };

        try {
            switch(mnemonic) {
                case 'add': case 'adc': case 'sub': case 'sbb':
                case 'and': case 'bor': case 'nor': case 'xor':
                    bin |= (getReg(args[0]) << 8) | (getReg(args[1]) << 3) | getReg(args[2]); break;
                case 'adi': case 'ldi':
                    bin |= (getReg(args[0]) << 8) | (getVal(args[1], 8) & 0xFF); break;
                case 'rsh': case 'ash': case 'mov':
                    bin |= (getReg(args[0]) << 8) | (getReg(args[1]) << 3); break;
                case 'jmp': case 'bge': case 'blt': case 'bng': case 'bps': case 'beq': case 'bne': case 'cal':
                    bin |= (getVal(args[0], 11) & 0x7FF); break;
                case 'mld': bin |= (getReg(args[0]) << 8) | getReg(args[1]); break;
                case 'mst': bin |= (getReg(args[0]) << 3) | getReg(args[1]); break;
                case 'psh': bin |= (getReg(args[0]) << 3); break;
                case 'pop': bin |= (getReg(args[0]) << 8); break;
            }
        } catch(e) { return reportError(e.message, item.lineIdx); }
        state.rom[item.pc] = bin;
        state.lineMap[item.pc] = item.lineIdx;
    }
    setStatus(`Assembled ${pc} instructions`, 'ok');
    return true;
}

function reportError(msg, lineIdx = -1) {
    setStatus(`${lineIdx >= 0 ? 'Line ' + (lineIdx + 1) + ': ' : ''}${msg}`, 'error');
    state.isRunning = false;
    return false;
}

function step(shouldPaint = true) {
    const word = state.rom[state.pc];
    const opcode = word & 0xF800;
    const rC = (word >> 8) & 0x7, rA = (word >> 3) & 0x7, rB = word & 0x7;
    const imm8 = word & 0xFF, imm11 = word & 0x7FF;
    let nextPC = (state.pc + 1) & 0x7FF;
    let res = 0, update = false;
    const read = r => r === 0 ? 0 : state.regs[r];
    const write = (r, v) => { if(r !== 0) state.regs[r] = v & 0xFF; };

    switch(opcode) {
        case OP.hlt:
            state.isRunning = false;
            const haltLine = (state.lineMap[state.pc] || 0) + 1;
            setStatus(`Program halted at line ${haltLine}`, 'ok');
            break;
        case OP.add: res = read(rA) + read(rB); write(rC, res); update = true; break;
        case OP.adc: res = read(rA) + read(rB) + state.flags.C; write(rC, res); update = true; break;
        case OP.adi: res = read(rC) + imm8; write(rC, res); update = true; break;
        case OP.sub: res = read(rA) - read(rB); write(rC, res); update = true; break;
        case OP.sbb: res = read(rA) - read(rB) - state.flags.C; write(rC, res); update = true; break;
        case OP.and: res = read(rA) & read(rB); write(rC, res); update = true; break;
        case OP.bor: res = read(rA) | read(rB); write(rC, res); update = true; break;
        case OP.nor: res = ~(read(rA) | read(rB)); write(rC, res); update = true; break;
        case OP.xor: res = read(rA) ^ read(rB); write(rC, res); update = true; break;
        case OP.rsh: res = read(rA) >> 1; write(rC, res); update = true; break;
        case OP.ash: res = (read(rA) >> 1) | (read(rA) & 0x80); write(rC, res); update = true; break;
        case OP.mov: write(rC, read(rA)); break;
        case OP.ldi: write(rC, imm8); break;
        case OP.jmp: nextPC = imm11; break;
        case OP.bge: if(state.flags.C) nextPC = imm11; break;
        case OP.blt: if(!state.flags.C) nextPC = imm11; break;
        case OP.bng: if(state.flags.N) nextPC = imm11; break;
        case OP.bps: if(!state.flags.N) nextPC = imm11; break;
        case OP.beq: if(state.flags.Z) nextPC = imm11; break;
        case OP.bne: if(!state.flags.Z) nextPC = imm11; break;
        case OP.mld:
            const mldAddr = read(rB) & 0x3F;
            if (mldAddr >= 60) write(rC, state.inputs[mldAddr - 60]);
            else write(rC, state.mem[mldAddr]);
            break;
        case OP.mst:
            const mstAddr = read(rB) & 0x3F;
            const val = read(rA);
            state.mem[mstAddr] = val;
            if (mstAddr >= 60) handleMMIO(mstAddr, val, shouldPaint);
            break;
        case OP.psh:
            if (state.sp < 16) state.stack[state.sp++] = read(rA);
            else return reportError("Stack Overflow", state.lineMap[state.pc]);
            break;
        case OP.pop:
            if (state.sp > 0) write(rC, state.stack[--state.sp]);
            else return reportError("Stack Underflow", state.lineMap[state.pc]);
            break;
        case OP.cal:
            if (state.sp < 16) { state.stack[state.sp++] = nextPC; nextPC = imm11; }
            else return reportError("Stack Overflow (Call)", state.lineMap[state.pc]);
            break;
        case OP.ret:
            if (state.sp > 0) nextPC = state.stack[--state.sp];
            else return reportError("Stack Underflow (Return)", state.lineMap[state.pc]);
            break;
    }
    if (update) {
        state.flags.Z = (res & 0xFF) === 0 ? 1 : 0;
        state.flags.N = (res & 0x80) ? 1 : 0;
        state.flags.C = (res > 255 || res < 0) ? 1 : 0;
    }
    state.pc = nextPC % 2048;
}

function handleMMIO(addr, val, shouldPaint = true) {
    if (addr === state.trigPort) updatePixel(shouldPaint);
    if (state.doubleBuffered && addr === state.pushPort) {
        state.vram.set(state.backBuffer);
        if (shouldPaint) renderCanvas();
    }
}

function updatePixel(shouldPaint = true) {
    const resX = state.dispResX;
    const resY = state.dispResY;
    let x = 0, y = 0, c = 0;
    for(let p=0; p<4; p++) {
        for(let b=0; b<8; b++) {
            const map = state.bitMaps[p][b];
            if (map.type === 'none') continue;
            const bit = (state.mem[60+p] >> b) & 1;
            if (bit) {
                if (map.type === 'x') x |= (1 << map.sig);
                else if (map.type === 'y') y |= (1 << map.sig);
                else if (map.type === 'c') c |= (1 << map.sig);
            }
        }
    }
    const rawX = state.decX ? state.startX - x : state.startX + x;
    const rawY = state.decY ? state.startY - y : state.startY + y;
    const fx = ((rawX % resX) + resX) % resX;
    const fy = ((rawY % resY) + resY) % resY;
    const index = fy * resX + fx;

    if (state.dispMode === 'mono') state.backBuffer[index] = 1;
    else state.backBuffer[index] = c;

    if (!state.doubleBuffered) {
        state.vram[index] = state.backBuffer[index];
        if (shouldPaint) {
            const canvas = $('#display-canvas');
            const ctx = canvas.getContext('2d');
            if (state.dispMode === 'mono') {
                const tex = state.textures.on;
                if (state.mono2x2) {
                    for (let row = 0; row < 2; row++)
                        for (let col = 0; col < 2; col++)
                            ctx.drawImage(tex, (fx * 32) + (col * 16), (fy * 32) + (row * 16));
                } else {
                    ctx.drawImage(tex, fx * 16, fy * 16);
                }
            } else {
                ctx.fillStyle = state.palette[c & 0xF];
                ctx.fillRect(fx * 16, fy * 16, 16, 16);
            }
        }
    }
}

function renderCanvas() {
    const canvas = $('#display-canvas');
    const ctx = canvas.getContext('2d');
    const resX = state.dispResX;
    const resY = state.dispResY;
    const mode = state.dispMode;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < resX * resY; i++) {
        const x = i % resX;
        const y = Math.floor(i / resX);
        const val = state.vram[i];
        if (mode === 'mono') {
            const tex = val ? state.textures.on : state.textures.off;
            if (state.mono2x2) {
                for (let r = 0; r < 2; r++)
                    for (let c = 0; c < 2; c++)
                        ctx.drawImage(tex, (x * 32) + (c * 16), (y * 32) + (r * 16));
            } else {
                ctx.drawImage(tex, x * 16, y * 16);
            }
        } else {
            ctx.fillStyle = state.palette[val & 0xF];
            ctx.fillRect(x * 16, y * 16, 16, 16);
        }
    }
}

function initUI() {
    const mapper = $('#bit-mapper');
    for (let p = 0; p < 4; p++) {
        const row = document.createElement('div'); row.className = 'bit-row';
        row.innerHTML = `<span>Port ${60+p}</span>`;
        for (let b = 7; b >= 0; b--) {
            const type = p === 0 ? 'x' : p === 1 ? 'y' : 'none';
            state.bitMaps[p][b] = { type, sig: b };
            const unit = document.createElement('div'); unit.className = 'bit-unit';
            unit.innerHTML = `
                <select onchange="state.bitMaps[${p}][${b}].type=this.value">
                    <option value="none" ${type==='none'?'selected':''}>-</option>
                    <option value="x" ${type==='x'?'selected':''}>X</option>
                    <option value="y" ${type==='y'?'selected':''}>Y</option>
                    <option value="c">C</option>
                </select>
                <select onchange="state.bitMaps[${p}][${b}].sig=parseInt(this.value)">
                    ${[0,1,2,3,4,5,6,7].map(s=>`<option value="${s}" ${s===b?'selected':''}>${s}</option>`).join('')}
                </select>`;
            row.appendChild(unit);
        }
        mapper.appendChild(row);
    }
    $('#palette-config').innerHTML = state.palette.map((c, i) => `
        <div class="palette-item"><input type="color" value="${c}" onchange="state.palette[${i}]=this.value;renderCanvas()"><span>${i}</span></div>
    `).join('');
}

function render() {
    $('#pc-val').textContent = state.pc.toString();
    $('#flag-c').className = 'flag' + (state.flags.C ? ' on' : '');
    $('#flag-n').className = 'flag' + (state.flags.N ? ' on' : '');
    $('#flag-z').className = 'flag' + (state.flags.Z ? ' on' : '');

    $('#regs-grid').innerHTML = Array.from(state.regs).map((v, i) =>
        `<div class="cell">R${i}<br><b>${formatValue(v, false)}</b></div>`
    ).join('');

    $('#mem-grid').innerHTML = Array.from(state.mem).map((v, i) =>
        `<div class="cell ${i >= 60 ? 'mmio' : ''}">${formatValue(v, false)}</div>`
    ).join('');

    const stackContainer = $('#stack-view');
    if (stackContainer) {
        let stackHtml = '';
        for (let i = state.sp - 1; i >= 0; i--) {
            const val = state.stack[i];
            stackHtml += `
                <div class="stack-item ${i === state.sp - 1 ? 'top' : ''}">
                    <span class="stack-addr">${i}</span>
                    <span class="stack-val">${formatValue(val, true)}</span>
                </div>`;
        }
        stackContainer.innerHTML = stackHtml || '<div class="stack-empty">Empty</div>';
    }

    $('#input-status-grid').innerHTML = Array.from(state.inputs).map((v, i) =>
        `<div class="cell">Port ${i}<br><span class="input-status-val">${formatValue(v)}</span></div>`
    ).join('');

    updateGutter();
    syncScroll();
}

function resizeCanvas() {
    const rx = state.dispResX, ry = state.dispResY;
    const mult = (state.dispMode === 'mono') ? (state.mono2x2 ? 32 : 16) : 16;
    $('#display-canvas').width = rx * mult;
    $('#display-canvas').height = ry * mult;
    renderCanvas();
}

function formatValue(val, isStack = false) {
    switch(state.viewMode) {
        case 'bin': {
            const bits = val.toString(2).padStart(isStack ? 16 : 8, '0');
            const half = bits.length / 2;
            return bits.slice(0, half) + '<br>' + bits.slice(half);
        }
        case 'dec': return val.toString(10);
        case 'hex':
        default: return '0x' + val.toString(16).toUpperCase().padStart(isStack ? 3 : 2, '0');
    }
}

function updateSpeedDisabled() {
    const sp = $('#speed');
    if (!sp) return;
    sp.disabled = state.unlimitedHz;
}

/* show/hide controls that only apply in certain modes */
function updateConditionalUI() {
    // colour palette only appears in Coloured mode
    const pal = $('#palette-panel');
    if (pal) pal.style.display = (state.dispMode === 'color') ? '' : 'none';
    // 2x2 pixels only applies to Monochrome
    const m2x2 = $('#mono-2x2-field');
    if (m2x2) m2x2.style.display = (state.dispMode === 'mono') ? '' : 'none';
    // "Push Display When" only applies when Double Buffered is on
    const push = $('#push-port-field');
    if (push) push.style.display = state.doubleBuffered ? '' : 'none';
}

function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;

    $('#editor').value = p.code;
    highlightCode();

    $('#disp-res-x').value = p.resX;
    $('#disp-res-y').value = p.resY;
    $('#disp-mode').value = p.mode;
    $('#unlimited-hz').checked = p.unlimited;
    $('#trig-port').value = p.trig;
    $('#push-port').value = p.push;
    $('#double-buffer').checked = p.buffer;
    $('#mono-2x2').checked = p.m2x2;

    state.palette = [...p.palette];
    const paletteInputs = document.querySelectorAll('#palette-config input');
    state.palette.forEach((color, i) => { if (paletteInputs[i]) paletteInputs[i].value = color; });

    for(let i=0; i<4; i++) for(let j=0; j<8; j++) state.bitMaps[i][j] = {type: 'none', sig: 0};
    const applyMap = (list, type) => { list.forEach(([port, bit], sig) => { state.bitMaps[port][bit] = { type, sig }; }); };
    applyMap(p.mapX, 'x');
    applyMap(p.mapY, 'y');
    applyMap(p.mapC, 'c');

    const bitUnits = document.querySelectorAll('.bit-unit');
    let unitIdx = 0;
    for(let port=0; port<4; port++) {
        for(let bit=7; bit>=0; bit--) {
            const unit = bitUnits[unitIdx++];
            const map = state.bitMaps[port][bit];
            unit.querySelector('select:nth-child(1)').value = map.type;
            unit.querySelector('select:nth-child(2)').value = map.sig;
        }
    }

    state.unlimitedHz = p.unlimited;
    state.doubleBuffered = p.buffer;
    state.dispMode = p.mode;
    state.dispResX = p.resX;
    state.dispResY = p.resY;
    state.mono2x2 = p.m2x2;
    state.trigPort = p.trig;
    state.pushPort = p.push;
    updateSpeedDisabled();
    updateConditionalUI();

    state.vram = new Uint8Array(state.dispResX * state.dispResY);
    state.backBuffer = new Uint8Array(state.dispResX * state.dispResY);
    resizeCanvas();

    assemble();
    $('#btn-reset').click();
    $('#btn-run').click();
}

function init() {
    initUI();
    state.trigPort = parseInt($('#trig-port').value) || 63;
    state.pushPort = parseInt($('#push-port').value) || 62;
    state.doubleBuffered = $('#double-buffer').checked;
    state.dispMode = $('#disp-mode').value;
    state.dispResX = parseInt($('#disp-res-x').value) || 128;
    state.dispResY = parseInt($('#disp-res-y').value) || 128;
    state.vram = new Uint8Array(state.dispResX * state.dispResY);
    state.backBuffer = new Uint8Array(state.dispResX * state.dispResY);
    state.startX = parseInt($('#start-x').value, 2) || 0;
    state.startY = parseInt($('#start-y').value, 2) || 0;
    state.decX = $('#dec-x').checked;
    state.decY = $('#dec-y').checked;
    state.mono2x2 = $('#mono-2x2').checked;
    resizeCanvas();

    const padRow = $('#bit-input-row');
    for (let i = 7; i >= 0; i--) {
        const btn = document.createElement('div');
        btn.className = 'bit-input';
        btn.textContent = i;
        btn.onclick = () => { state.padValue ^= (1 << i); btn.classList.toggle('on'); };
        padRow.appendChild(btn);
    }

    $('#btn-in-send').onclick = () => {
        const portIdx = parseInt($('#in-port-sel').value);
        state.inputs[portIdx] = state.padValue;
        render();
    };

    $('#trig-port').onchange = (e) => state.trigPort = parseInt(e.target.value);
    $('#push-port').onchange = (e) => state.pushPort = parseInt(e.target.value);
    $('#double-buffer').onchange = (e) => { state.doubleBuffered = e.target.checked; updateConditionalUI(); };
    $('#disp-mode').onchange = (e) => { state.dispMode = e.target.value; resizeCanvas(); updateConditionalUI(); };
    $('#start-x').onchange = (e) => state.startX = parseInt(e.target.value, 2) || 0;
    $('#start-y').onchange = (e) => state.startY = parseInt(e.target.value, 2) || 0;
    $('#dec-x').onchange = (e) => state.decX = e.target.checked;
    $('#dec-y').onchange = (e) => state.decY = e.target.checked;
    $('#mono-2x2').onchange = (e) => { state.mono2x2 = e.target.checked; resizeCanvas(); };

    const updateRes = () => {
        state.dispResX = parseInt($('#disp-res-x').value);
        state.dispResY = parseInt($('#disp-res-y').value);
        state.vram = new Uint8Array(state.dispResX * state.dispResY);
        state.backBuffer = new Uint8Array(state.dispResX * state.dispResY);
        resizeCanvas();
    };
    $('#disp-res-x').onchange = updateRes;
    $('#disp-res-y').onchange = updateRes;

    // segmented hex/bin/dec toggle
    document.querySelectorAll('#view-mode button').forEach(b => {
        b.onclick = () => {
            state.viewMode = b.dataset.mode;
            document.querySelectorAll('#view-mode button').forEach(x => x.classList.toggle('active', x === b));
            render();
        };
    });

    // line numbering toggle (source vs assembled)
    document.querySelectorAll('#gutter-mode button').forEach(b => {
        b.onclick = () => {
            state.gutterMode = b.dataset.gmode;
            document.querySelectorAll('#gutter-mode button').forEach(x => x.classList.toggle('active', x === b));
            assemble();
            highlightCode();
        };
    });

    // draggable left column
    const resizer = $('#col-resizer');
    let dragging = false;
    resizer.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); document.body.style.userSelect = 'none'; });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const appLeft = $('.app').getBoundingClientRect().left;
        let w = e.clientX - appLeft;
        const max = window.innerWidth * 0.6, min = 280;
        w = Math.max(min, Math.min(max, w));
        document.documentElement.style.setProperty('--col-left', w + 'px');
    });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; document.body.style.userSelect = ''; } });

    // draggable right column
    const resizerR = $('#col-resizer-right');
    let draggingR = false;
    resizerR.addEventListener('mousedown', (e) => { draggingR = true; e.preventDefault(); document.body.style.userSelect = 'none'; });
    window.addEventListener('mousemove', (e) => {
        if (!draggingR) return;
        const appRight = $('.app').getBoundingClientRect().right;
        let w = appRight - e.clientX;
        const max = window.innerWidth * 0.6, min = 260;
        w = Math.max(min, Math.min(max, w));
        document.documentElement.style.setProperty('--col-right', w + 'px');
    });
    window.addEventListener('mouseup', () => { if (draggingR) { draggingR = false; document.body.style.userSelect = ''; } });

    $('#btn-run').onclick = () => {
        if (!assemble()) return;
        state.isRunning = true;
        state.instructionsRun = 0;
        state.lastHzUpdate = performance.now();
        setStatus('Running…', 'run');

        const hzCounterTimer = setInterval(() => {
            if (!state.isRunning) { clearInterval(hzCounterTimer); $('#actual-hz').textContent = "0"; return; }
            const now = performance.now();
            const duration = (now - state.lastHzUpdate) / 1000;
            const actualHz = Math.round(state.instructionsRun / duration);
            $('#actual-hz').textContent = actualHz.toLocaleString();
            state.instructionsRun = 0;
            state.lastHzUpdate = now;
        }, 1000);

        const runLoop = () => {
            if (!state.isRunning) return;
            if (state.unlimitedHz) {
                for (let i = 0; i < 50000; i++) {
                    if (state.isRunning) { step(false); state.instructionsRun++; } else break;
                }
                render();
                renderCanvas();
                requestAnimationFrame(runLoop);
            } else {
                const hz = parseInt($('#speed').value) || 60;
                const batchSize = Math.ceil(hz / 60);
                for (let i = 0; i < batchSize; i++) {
                    if (state.isRunning) { step(true); state.instructionsRun++; }
                }
                render();
                if (state.doubleBuffered) renderCanvas();
                setTimeout(runLoop, 1000 / 60);
            }
        };
        runLoop();
    };

    $('#btn-stop').onclick = () => { state.isRunning = false; $('#actual-hz').textContent = "0"; };
    $('#btn-step').onclick = () => { if (assemble()) step(); render(); };
    $('#btn-reset').onclick = () => {
        state.pc = 0; state.sp = 0; state.regs.fill(0);
        state.mem.fill(0); state.vram.fill(0); state.backBuffer.fill(0); state.flags = {C:0,N:0,Z:0};
        state.isRunning = false;
        setStatus("Ready", '');
        state.inputs.fill(0);
        state.padValue = 0;
        $('#actual-hz').textContent = "0";
        document.querySelectorAll('.bit-input').forEach(b => b.classList.remove('on'));
        render(); renderCanvas();
    };

    $('#editor').oninput = highlightCode;
    $('#editor').onscroll = syncScroll;
    render();

    $('#unlimited-hz').onchange = (e) => { state.unlimitedHz = e.target.checked; updateSpeedDisabled(); };

    state.textures.off.onload = () => renderCanvas();
    state.textures.on.onload = () => renderCanvas();
    state.textures.off.src = "images/redstone_lamp.png";
    state.textures.on.src = "images/redstone_lamp_on.png";

    $('#presets').onchange = (e) => applyPreset(e.target.value);
    applyPreset('default');
    updateSpeedDisabled();
    updateConditionalUI();
}

init();
