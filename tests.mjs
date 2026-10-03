// 言灵语言内核测试：从 HTML 抽取 CORE 段，在 Node 里直接跑
// 用法：node tests.mjs [HTML路径]  （默认 ./yanling.html）
import { readFileSync } from 'node:fs';

const htmlPath = process.argv[2] ?? './yanling.html';
const html = readFileSync(new URL(htmlPath, import.meta.url), 'utf8');
const m = html.match(/\/\*YANLING-CORE-START\*\/([\s\S]*?)\/\*YANLING-CORE-END\*\//);
if (!m) { console.error('未找到 CORE 段'); process.exit(1); }
(0, eval)(m[1]);
const Y = globalThis.YANLING;
if (!Y) { console.error('内核未挂载到 globalThis'); process.exit(1); }

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  ← ' + extra : ''}`); }
}
function run(src) { return Y.运行(src); }
function runErr(src) {
  try { Y.运行(src); return null; }
  catch (e) { return e.言灵 ? e : { message: '内部错误: ' + e.message, 行: -1 }; }
}

console.log('— 词法与表达式 —');
ok('优先级 1+2*3=7', JSON.stringify(run('打印(1 + 2 * 3)')) === '["7"]');
ok('除法 7/2=3.5', run('打印(7 / 2)')[0] === '3.5');
ok('负数取模 -7%3=2', run('打印(-7 % 3)')[0] === '2');
ok('串+数拼接', run('打印(「值：」 + 42)')[0] === '值：42');
ok('「」与""等价', run('打印(「你」 == "你")')[0] === '真');
ok('多参打印', run('打印(「a」, 1, [1, 2])')[0] === 'a 1 [1, 2]');
ok('且/或/非', run('打印(2 > 1 且 3 > 5 或 非 假)')[0] === '真');
ok('注释被忽略', run('# 这是注释\n打印(1) # 行尾注释').length === 1);
ok('双层列表深比较', run('打印([1,[2,3]] == [1,[2,3]])')[0] === '真');

console.log('— 控制流 —');
ok('如果/否则分支', run('如果 1 > 2 { 打印(「错」) } 否则 { 打印(「对」) }')[0] === '对');
ok('跳出', run('让 i = 0\n当 真 { 让 i = i + 1\n  如果 i == 5 { 跳出 } }\n打印(i)')[0] === '5');
ok('下一个', (() => {
  const r = run('让 i = 0\n让 计 = 0\n当 i < 10 { 让 i = i + 1\n  如果 i % 2 == 0 { 下一个 }\n  让 计 = 计 + 1 }\n打印(计)');
  return r[0] === '5';
})());

console.log('— 函数 —');
ok('递归 阶乘(5)=120', run(`术 阶乘(n) { 如果 n <= 1 { 返回 1 }\n  返回 n * 阶乘(n - 1) }\n打印(阶乘(5))`)[0] === '120');
ok('闭包（计数器）', run(`术 制造() {\n  让 n = 0\n  返回 术() { 让 n = n + 1\n    返回 n } }\n让 计 = 制造()\n计()\n计()\n打印(计())`)[0] === '3');
ok('函数是一等公民', run(`术 两倍(x) { 返回 x * 2 }\n让 f = 两倍\n打印(f(21))`)[0] === '42');
ok('递归深度报错', (() => {
  const e = runErr('术 f(n) { 返回 f(n + 1) }\nf(0)');
  return e && /递归太深/.test(e.message);
})());

console.log('— 列表 —');
ok('索引赋值', run('让 列 = [1, 2, 3]\n让 列[1] = 99\n打印(文本(列))')[0] === '[1, 99, 3]');
ok('推入/弹出/长度', run('让 列 = []\n推入(列, 7)\n推入(列, 8)\n弹出(列)\n打印(长度(列) + 「:」 + 文本(列))')[0] === '1:[7]');
ok('越界报错', (() => {
  const e = runErr('打印(取([1, 2], 5))');
  return e && /越界/.test(e.message);
})());

console.log('— 错误与熔断 —');
ok('未知名字报行号', (() => {
  const e = runErr('打印(1)\n打印(不存在的东西)');
  return e && e.行 === 2 && /不认识的名字/.test(e.message);
})());
ok('零作除数', (() => {
  const e = runErr('打印(1 / 0)');
  return e && /零不能作除数/.test(e.message);
})());
ok('条件必须是真假', (() => {
  const e = runErr('如果 1 { 打印(1) }');
  return e && /条件必须是/.test(e.message);
})());
ok('死循环熔断', (() => {
  const e = runErr('当 真 { }');
  return e && /熔断/.test(e.message);
})(), '死循环应当被熔断');
ok('保留字不能当变量名', (() => {
  const e = runErr('让 如果 = 1');
  return e && /应当跟一个名字/.test(e.message);
})());

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
