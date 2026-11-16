import { Component, signal } from '@angular/core'; // 1. Importe o signal
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

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

  constructor(private http: HttpClient) {}

  procurarPokemon() {
    if(this.timePokemon().length >= 2) {
      alert('Você já tem 6 Pokémon no time. Não é possível adicionar mais.');
      return;
    }
    if (!this.nomePokemon.trim()) return;

    const urlPokeAPI = `https://pokeapi.co/api/v2/pokemon/${this.nomePokemon.toLowerCase().trim()}`;
    
    this.http.get<any>(urlPokeAPI).subscribe({
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

  checarFraquezas(timePokemon: any[]) {
      console.log('Time de Pokémon:', timePokemon);
      this.fraquezas.set([]); // Limpa a lista anterior antes de buscar novamente

      for (const pokemon of timePokemon) {
        const urlPokeAPI = `https://pokeapi.co/api/v2/pokemon/${pokemon.nomePokemon.toLowerCase().trim()}`;
        
        this.http.get<any>(urlPokeAPI).subscribe({
          next: (dadosPokemon) => {
            const tipos = dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name);
            
            for (const tipo of tipos) {
              const urlTipoAPI = `https://pokeapi.co/api/v2/type/${tipo}`;
              
              this.http.get<any>(urlTipoAPI).subscribe({
                next: (dadosTipo) => {
                  const fraquezasTipo = dadosTipo.damage_relations.double_damage_from.map(
                    (typeInfo: any) => typeInfo.name
                  );
                  this.fraquezas.update((listaAtual) =>[
                    ...listaAtual, 
                    ...fraquezasTipo]);
                },
                error: (erro) => {
                console.error('Erro ao buscar tipo do Pokémon:', erro);
                }
              });
            }
          },
          error: (erro) => {
          console.error('Erro ao buscar Pokémon:', erro);
          }
        });
      }
    }

    checarResistencias(timePokemon: any[]) {
      console.log('Time de Pokémon:', timePokemon);
      this.resistencias.set([]); // Limpa a lista anterior antes de buscar novamente

      for (const pokemon of timePokemon) {
        const urlPokeAPI = `https://pokeapi.co/api/v2/pokemon/${pokemon.nomePokemon.toLowerCase().trim()}`;
        
        this.http.get<any>(urlPokeAPI).subscribe({
          next: (dadosPokemon) => {
            const tipos = dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name);
            
            for (const tipo of tipos) {
              const urlTipoAPI = `https://pokeapi.co/api/v2/type/${tipo}`;
              
              this.http.get<any>(urlTipoAPI).subscribe({
                next: (dadosTipo) => {
                  const resistenciasTipo = dadosTipo.damage_relations.half_damage_from.map(
                    (typeInfo: any) => typeInfo.name
                  );
                  this.resistencias.update((listaAtual) =>[
                    ...listaAtual, 
                    ...resistenciasTipo]);
                },
                error: (erro) => {
                console.error('Erro ao buscar tipo do Pokémon:', erro);
                }
              });
            }
          },
          error: (erro) => {
          console.error('Erro ao buscar Pokémon:', erro);
          }
        });
      }
    }
  checarImunidades(timePokemon: any[]) {
    console.log('Time de Pokémon:', timePokemon);
    this.imunidades.set([]); // Limpa a lista anterior antes de buscar novamente

    for (const pokemon of timePokemon) {
      const urlPokeAPI = `https://pokeapi.co/api/v2/pokemon/${pokemon.nomePokemon.toLowerCase().trim()}`;
      
      this.http.get<any>(urlPokeAPI).subscribe({
        next: (dadosPokemon) => {
          const tipos = dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name);
          
          for (const tipo of tipos) {
            const urlTipoAPI = `https://pokeapi.co/api/v2/type/${tipo}`;
            
            this.http.get<any>(urlTipoAPI).subscribe({
              next: (dadosTipo) => {
                const imunidadesTipo = dadosTipo.damage_relations.no_damage_from.map(
                  (typeInfo: any) => typeInfo.name
                );
                this.imunidades.update((listaAtual) =>[
                  ...listaAtual, 
                  ...imunidadesTipo]);
              },
              error: (erro) => {
              console.error('Erro ao buscar tipo do Pokémon:', erro);
              }
            });
          }
        },
        error: (erro) => {
        console.error('Erro ao buscar Pokémon:', erro);
        }
      });
    }
  }
  diferenciarFraquezas() {
    this.fraquezas.set([...new Set(this.fraquezas())]);
    this.resistencias.set([...new Set(this.resistencias())]);
    this.imunidades.set([...new Set(this.imunidades())]);
    this.resultado.set(this.fraquezas().filter(fraqueza => !this.resistencias().includes(fraqueza) && !this.imunidades().includes(fraqueza)));
  }
}