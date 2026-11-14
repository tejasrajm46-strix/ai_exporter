const cases = {
  frac: String.raw`\frac{a}{b}`,
  nestedFrac: String.raw`\frac{1}{\frac{a}{b}}`,
  sqrt: String.raw`\sqrt{x+1}`,
  root3: String.raw`\sqrt[3]{x}`,
  sup: String.raw`x^{n+1}`,
  sub: String.raw`a_{ij}`,
  ratio: String.raw`\frac{x^2+1}{x-1}`,
  sum: String.raw`\sum_{i=1}^{n} i`,
  integral: String.raw`\int_0^1 x^2\,dx`,
  bmatrix: String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}`,
  sets: String.raw`a+H=\{a+h:h\in H\}`,
  limit: String.raw`\lim_{x\to 0}\frac{\sin x}{x}`,
  comment: String.raw`x^2 % this is a comment`,
  sinx: String.raw`\sin x`,
  aligned: String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`
};
return Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, { mathml: AIExporter.texToMathML(v, true), text: AIExporter.texToMathML(v, true).replace(/<[^>]*>/g, " ") }]));
