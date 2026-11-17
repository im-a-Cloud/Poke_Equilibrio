import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-home-component',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './home-component.html',
  styleUrl: './home-component.css',
})
export class HomeComponent {
  nomePokemon: string = '';

  timePokemon = signal<any[]>([]);
  fraquezas = signal<string[]>([]);
  resistencias = signal<string[]>([]);
  imunidades = signal<string[]>([]);
  resultado = signal<string[]>([]);

  ofensivaSuperEficaz = signal<string[]>([]);
  ofensivaPoucoEficaz = signal<string[]>([]);
  ofensivaIneficaz = signal<string[]>([]);

  fraquezasAgrupadas = computed(() => {
    const contagem: Record<string, number> = {};

    for (const tipo of this.resultado()) {
      contagem[tipo] = (contagem[tipo] ?? 0) + 1;
    }

    return Object.entries(contagem)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  });

  urlPokeAPI = 'https://pokeapi.co/api/v2/pokemon';

  constructor(private http: HttpClient) {}

  procurarPokemon() {
    if (this.timePokemon().length >= 6) {
      alert('Você já tem 6 Pokémon no time. Não é possível adicionar mais.');
      return;
    }
    if (!this.nomePokemon.trim()) return;

    const url = `${this.urlPokeAPI}/${this.nomePokemon.toLowerCase().trim()}`;

    this.http.get<any>(url).subscribe({
      next: (dadosPokemon) => {
        this.timePokemon.update((listaAtual) => [
          ...listaAtual,
          {
            nomePokemon: dadosPokemon.name,
            imagemPokemon: dadosPokemon.sprites.front_default,
            tiposPokemon: dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name).join(', '),
          }
        ]);

        this.nomePokemon = '';
      },
      error: (erro) => {
        console.error('Erro ao buscar Pokémon:', erro);
        alert('Pokémon não encontrado. Por favor, verifique o nome e tente novamente.');
      }
    });
  }

  calculoGeral(timePokemon: any[]) {
    console.log('Time de Pokémon:', timePokemon);
    this.imunidades.set([]);
    this.fraquezas.set([]);
    this.resistencias.set([]);
    this.resultado.set([]);

    for (const pokemon of timePokemon) {
      const url = `${this.urlPokeAPI}/${pokemon.nomePokemon.toLowerCase().trim()}`;

      this.http.get<any>(url).subscribe({
        next: (dadosPokemon) => {
          const tipos = dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name);

          const requisicoesTipos = tipos.map((tipo: string) =>
            this.http.get<any>(`https://pokeapi.co/api/v2/type/${tipo}`)
          );

          forkJoin(requisicoesTipos).subscribe({
            next: (listaDadosTipos: any) => {
              const multiplicadores: Record<string, number> = {};

              for (const dadosTipo of listaDadosTipos) {
                const imunidadesTipo = dadosTipo.damage_relations.no_damage_from.map(
                  (typeInfo: any) => typeInfo.name
                );
                const fraquezasTipo = dadosTipo.damage_relations.double_damage_from.map(
                  (typeInfo: any) => typeInfo.name
                );
                const resistenciasTipo = dadosTipo.damage_relations.half_damage_from.map(
                  (typeInfo: any) => typeInfo.name
                );

                this.imunidades.update((listaAtual) => [...listaAtual, ...imunidadesTipo]);
                this.fraquezas.update((listaAtual) => [...listaAtual, ...fraquezasTipo]);
                this.resistencias.update((listaAtual) => [...listaAtual, ...resistenciasTipo]);

                for (const tipoAtacante of fraquezasTipo) {
                  multiplicadores[tipoAtacante] = (multiplicadores[tipoAtacante] ?? 1) * 2;
                }
                for (const tipoAtacante of resistenciasTipo) {
                  multiplicadores[tipoAtacante] = (multiplicadores[tipoAtacante] ?? 1) * 0.5;
                }
                for (const tipoAtacante of imunidadesTipo) {
                  multiplicadores[tipoAtacante] = 0;
                }
              }

              const fraquezasReaisPokemon = Object.keys(multiplicadores).filter(
                (tipoAtacante) => multiplicadores[tipoAtacante] > 1
              );

              this.resultado.update((listaAtual) => [
                ...listaAtual,
                ...fraquezasReaisPokemon
              ]);
            },
            error: (erro) => {
              console.error('Erro ao buscar tipo do Pokémon:', erro);
            }
          });
        },
        error: (erro) => {
          console.error('Erro ao buscar Pokémon:', erro);
        }
      });
    }
  }
}