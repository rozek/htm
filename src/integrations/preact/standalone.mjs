/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { h, createElement, cloneElement, Component, createContext, createRef, render, hydrate, toChildArray } from 'preact';
import { useState, useReducer, useEffect, useLayoutEffect, useRef, useImperativeHandle, useMemo, useCallback, useContext, useDebugValue, useErrorBoundary, useId } from 'preact/hooks';
import { /*signal, computed, effect, batch,*/ untracked, useSignal, useComputed, useSignalEffect } from '@preact/signals';
import { createPortal } from 'preact/compat'

import htm from '../../index.mjs';

const html = htm.bind(h);

export {
  html,
  h, createElement, cloneElement, Component, createContext, createRef, render, hydrate, toChildArray,
  useState, useReducer, useEffect, useLayoutEffect, useRef, useImperativeHandle, useMemo, useCallback, useContext, useDebugValue, useErrorBoundary, useId,
  /*signal, computed, effect, batch,*/ untracked, useSignal, useComputed, useSignalEffect,
  createPortal
};
export * from '@preact/signals-core'
