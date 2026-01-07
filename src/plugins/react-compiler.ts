import type { BunPlugin } from "bun";
import * as babel from "@babel/core";
import BabelPluginReactCompiler from "babel-plugin-react-compiler";

export function reactCompilerPlugin(options: { filter?: RegExp } = {}): BunPlugin {
  const filter = options.filter ?? /\.[jt]sx$/;

  return {
    name: "react-compiler",
    setup({ onLoad }) {
      onLoad({ filter }, async (args) => {
        const input = await Bun.file(args.path).text();
        const result = await babel.transformAsync(input, {
          filename: args.path,
          plugins: [[BabelPluginReactCompiler, {}]],
          parserOpts: { plugins: ["jsx", "typescript"] },
          ast: false,
          sourceMaps: "inline",
          configFile: false,
          babelrc: false,
        });

        if (!result?.code) {
          throw new Error("React Compiler transform returned null");
        }

        return { contents: result.code, loader: "tsx" };
      });
    },
  };
}
