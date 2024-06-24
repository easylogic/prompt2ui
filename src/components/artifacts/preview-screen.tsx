"use client";

import { useEffect, useState } from "react";
import * as React from "react";
import * as Babel from "@babel/standalone";
import * as phosphorIcons from "@phosphor-icons/react";
import * as recharts from "recharts";
import * as shadcnComponents from "@/components/ui";
import * as datefns from "date-fns";
import * as THREE from 'three';
import * as Fiber from '@react-three/fiber';
import * as Drei from '@react-three/drei';

interface PreviewScreenProps {
  code: string;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            color: "red",
            padding: "10px",
            border: "1px solid red",
            borderRadius: "4px",
          }}
        >
          <h3>Runtime Error:</h3>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const importToVariablePlugin = ({ types: t }: any) => ({
  visitor: {
    ImportDeclaration(path: any) {
      const declarations = path.node.specifiers
        .map((specifier: any) => {
          if (t.isImportDefaultSpecifier(specifier)) {
            return t.variableDeclarator(
              specifier.local,
              t.memberExpression(
                t.identifier("scope"),
                t.identifier(specifier.local.name)
              )
            );
          } else if (t.isImportSpecifier(specifier)) {

            return t.variableDeclarator(
              specifier.local,
              t.memberExpression(
                t.identifier("scope"),
                specifier.imported
              )
            );
          }
          return null;
        })
        .filter(Boolean);

      path.replaceWith(t.variableDeclaration("const", declarations));
    },
    ExportDefaultDeclaration(path: any) {
      const declaration = path.node.declaration;
      if (t.isFunctionDeclaration(declaration)) {
        // If it's a function declaration, we need to split it into a function declaration and an export
        const functionName = declaration.id ? declaration.id.name : 'default';
        path.replaceWithMultiple([
          declaration,
          t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(
                t.identifier("exports"),
                t.identifier("default")
              ),
              t.identifier(functionName)
            )
          )
        ]);
      } else {
        // For other types of declarations, we can use the original logic
        path.replaceWith(
          t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(
                t.identifier("exports"),
                t.identifier("default")
              ),
              declaration
            )
          )
        );
      }
    },
  },
});

export function PreviewScreen({ code }: PreviewScreenProps) {
  const [component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const compileAndRender = async () => {
      try {
        console.log(code);
        const transpiledCode = Babel.transform(code, {
          presets: ["react"],
          plugins: [importToVariablePlugin],
        }).code;

        console.log(transpiledCode);

        const scope: any = {
          React: {
            ...React,
            useState: React.useState,
            useEffect: React.useEffect,
            useRef: React.useRef,
          },
          ...React,
          ...shadcnComponents,
          ...phosphorIcons,
          ...recharts,
          ...datefns,
          ...THREE,
          ...Fiber,
          ...Drei,
        };

        const fullCode = `
          const exports = {};
          ${transpiledCode}
          return exports.default;
        `;

        const evalCode = new Function("scope", fullCode);
        const ComponentToRender = evalCode(scope);

        if (typeof ComponentToRender === "function") {
          if (isMounted) {
            setComponent(() => ComponentToRender);
            setError(null);
          }
        } else {
          if (isMounted) {
            setError("The code did not export a valid React component.");
          }
        }
      } catch (error: any) {
        console.error("Error transpiling or evaluating code:", error);
        if (isMounted) {
          setError(
            error.message || "An error occurred while rendering the component."
          );
        }
      }
    };

    compileAndRender();

    return () => {
      isMounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <div
        style={{
          color: "red",
          padding: "10px",
          border: "1px solid red",
          borderRadius: "4px",
        }}
      >
        <h3>Compilation Error:</h3>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {component ? React.createElement(component) : <div>Loading...</div>}
    </ErrorBoundary>
  );
}