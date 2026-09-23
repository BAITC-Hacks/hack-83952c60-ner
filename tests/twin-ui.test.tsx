// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DigitalTwin from '../src/twin/DigitalTwin';
import App from '../src/App';
import { STORAGE_KEY } from '../src/twin/storage';
import { advanceSession, initializeSession } from '../src/twin/model';

afterEach(()=>{cleanup();localStorage.clear();window.location.hash='';vi.useRealTimers();vi.restoreAllMocks();});
it('selects map layers and districts, runs projects, saves and restores independent snapshots',()=>{
  localStorage.setItem('classic-unrelated','preserved');
  render(<DigitalTwin/>);
  fireEvent.change(screen.getByLabelText('Слой карты'),{target:{value:'ecology'}});
  expect(screen.getByLabelText('Схематическая карта: Экология')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Район Есиль'}));
  fireEvent.click(screen.getByRole('button',{name:'Запустить: Зелёный пояс'}));
  fireEvent.click(screen.getByRole('button',{name:'Следующий месяц'}));
  fireEvent.change(screen.getByLabelText('Название сценария'),{target:{value:'Озеленение'}});
  fireEvent.click(screen.getByRole('button',{name:'Сохранить снимок'}));
  fireEvent.click(screen.getByRole('button',{name:'Следующий месяц'}));
  expect(screen.getByTestId('twin-month').textContent).toContain('2 / 60');
  fireEvent.click(screen.getByRole('button',{name:'Загрузить Озеленение'}));
  expect(screen.getByTestId('twin-month').textContent).toContain('1 / 60');
  fireEvent.click(screen.getByRole('button',{name:'Новый сценарий'}));
  expect(screen.getByTestId('twin-month').textContent).toContain('0 / 60');
  expect(screen.getByRole('button',{name:'Загрузить Озеленение'})).toBeTruthy();
  expect(localStorage.getItem('classic-unrelated')).toBe('preserved');
});
it('plays at both speeds, pauses and cleans up on unmount',()=>{
  vi.useFakeTimers();
  const view=render(<DigitalTwin/>);
  fireEvent.click(screen.getByRole('button',{name:'Запустить время'}));
  act(()=>{vi.advanceTimersByTime(1200);});
  expect(screen.getByTestId('twin-month').textContent).toContain('1 / 60');
  fireEvent.change(screen.getByLabelText('Скорость'),{target:{value:'300'}});
  act(()=>{vi.advanceTimersByTime(600);});
  expect(screen.getByTestId('twin-month').textContent).toContain('3 / 60');
  fireEvent.click(screen.getByRole('button',{name:'Пауза'}));
  act(()=>{vi.advanceTimersByTime(1200);});
  expect(screen.getByTestId('twin-month').textContent).toContain('3 / 60');
  fireEvent.click(screen.getByRole('button',{name:'Запустить время'}));
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('stops automatically at month 60, shows results and disallows further actions',()=>{
  let session=initializeSession();for(let i=0;i<59;i++)session=advanceSession(session);
  localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,draft:session,snapshots:[]}));
  vi.useFakeTimers();render(<DigitalTwin/>);
  fireEvent.click(screen.getByRole('button',{name:'Запустить время'}));
  act(()=>{vi.advanceTimersByTime(2400);});
  expect(screen.getByRole('heading',{name:'Итоги пяти лет'})).toBeTruthy();
  expect((screen.getByRole('button',{name:'Следующий месяц'}) as HTMLButtonElement).disabled).toBe(true);
  act(()=>{vi.advanceTimersByTime(5000);});
  expect(screen.getByTestId('twin-month').textContent).toContain('60 / 60');
  expect(screen.getByRole('button',{name:'Запустить время'})).toBeTruthy();
});
it('continues in memory when writes fail and warns about persistence',()=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  render(<DigitalTwin/>);
  expect(screen.getByRole('status').textContent).toMatch(/памяти/);
  fireEvent.click(screen.getByRole('button',{name:'Следующий месяц'}));
  expect(screen.getByTestId('twin-month').textContent).toContain('1 / 60');
});
it('navigates between modes while preserving the classic selection and twin draft',async()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Эталон ТЗ'}));
  act(()=>{window.location.hash='#/digital-twin';window.dispatchEvent(new HashChangeEvent('hashchange'));});
  await screen.findByRole('heading',{name:'Цифровой двойник'});
  fireEvent.click(screen.getByRole('button',{name:'Следующий месяц'}));
  fireEvent.click(screen.getByRole('button',{name:'Запустить время'}));
  act(()=>{window.location.hash='';window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(screen.queryByRole('heading',{name:'Цифровой двойник'})).toBeNull();
  expect(within(screen.getByRole('region',{name:'Путь решения'})).getByRole('button',{name:'Сохранить и сравнить варианты'})).toBeTruthy();
  act(()=>{window.location.hash='#/digital-twin';window.dispatchEvent(new HashChangeEvent('hashchange'));});
  await screen.findByRole('heading',{name:'Цифровой двойник'});
  expect(screen.getByTestId('twin-month').textContent).toContain('1 / 60');
  expect(screen.getByRole('button',{name:'Запустить время'})).toBeTruthy();
});
