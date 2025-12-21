package web

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/hound-search/hound/api"
	"github.com/hound-search/hound/config"
	"github.com/hound-search/hound/searcher"
	"github.com/hound-search/hound/ui"
)

// Server is an HTTP server that handles all
// http traffic for hound. It is able to serve
// some traffic before indexes are built and
// then transition to all traffic afterwards.
type Server struct {
	cfg        *config.Config
	configFile string
	dev        bool
	ch         chan error

	mux           *http.ServeMux
	lck           sync.RWMutex
	searchers     map[string]*searcher.Searcher
	searchersLock sync.RWMutex
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == s.cfg.HealthCheckURI {
		fmt.Fprintln(w, "👍")
		return
	}

	s.lck.RLock()
	defer s.lck.RUnlock()
	if m := s.mux; m != nil {
		m.ServeHTTP(w, r)
	} else {
		http.Error(w,
			"Hound is not ready.",
			http.StatusServiceUnavailable)
	}
}

func (s *Server) serveWith(m *http.ServeMux) {
	s.lck.Lock()
	defer s.lck.Unlock()
	s.mux = m
}

// Start creates a new server that will immediately start handling HTTP traffic.
// The HTTP server will return 200 on the health check, but a 503 on every other
// request until ServeWithIndex is called to begin serving search traffic with
// the given searchers.
func Start(cfg *config.Config, addr string, dev bool) *Server {
	return StartWithConfigFile(cfg, "config.json", addr, dev)
}

// StartWithConfigFile creates a new server with a specific config file path
func StartWithConfigFile(cfg *config.Config, configFile string, addr string, dev bool) *Server {
	ch := make(chan error)

	s := &Server{
		cfg:        cfg,
		configFile: configFile,
		dev:        dev,
		ch:         ch,
	}

	go func() {
		ch <- http.ListenAndServe(addr, s)
	}()

	return s
}

// ServeWithIndex allow the server to start offering the search UI and the
// search APIs operating on the given indexes.
func (s *Server) ServeWithIndex(idx map[string]*searcher.Searcher) error {
	s.searchersLock.Lock()
	s.searchers = idx
	s.searchersLock.Unlock()

	h, err := ui.Content(s.dev, s.cfg)
	if err != nil {
		return err
	}

	m := http.NewServeMux()
	m.Handle("/", h)
	api.Setup(m, s, s.cfg.ResultLimit)

	s.serveWith(m)

	return <-s.ch
}

// GetSearchers returns the current searchers map (thread-safe)
func (s *Server) GetSearchers() map[string]*searcher.Searcher {
	s.searchersLock.RLock()
	defer s.searchersLock.RUnlock()
	// Return a copy to avoid race conditions
	result := make(map[string]*searcher.Searcher)
	for k, v := range s.searchers {
		result[k] = v
	}
	return result
}

// AddSearcher adds a new searcher to the server (thread-safe)
func (s *Server) AddSearcher(name string, srch *searcher.Searcher) {
	s.searchersLock.Lock()
	defer s.searchersLock.Unlock()
	if s.searchers == nil {
		s.searchers = make(map[string]*searcher.Searcher)
	}
	s.searchers[name] = srch
}

// GetConfig returns the server's config
func (s *Server) GetConfig() *config.Config {
	return s.cfg
}

// GetConfigFile returns the config file path
func (s *Server) GetConfigFile() string {
	return s.configFile
}
